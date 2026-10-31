import secrets
import pyotp
from django.conf import settings
from django.contrib.auth import login as django_login, logout as django_logout
from django.core.mail import send_mail
from rest_framework import status, views, permissions
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from drf_spectacular.utils import extend_schema

from .models import User, UserProfile
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserDetailSerializer,
    UserProfileSerializer,
    ChangePasswordSerializer,
    TwoFactorVerifySerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    DeleteAccountSerializer,
)
from audit.service import record_audit_event

class RegisterView(views.APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(request=UserRegistrationSerializer, responses={201: UserDetailSerializer})
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate email verification token
        user.verification_token = secrets.token_urlsafe(32)
        user.save(update_fields=['verification_token'])

        token, _ = Token.objects.get_or_create(user=user)

        record_audit_event(
            action="AUTH_REGISTER",
            actor=user,
            target_type="User",
            target_id=str(user.id),
            details={"email": user.email},
            request=request
        )

        return Response({
            "token": token.key,
            "user": UserDetailSerializer(user).data,
            "verification_token": user.verification_token, # returned for local dev / testing verification
            "message": "Registration successful. Please verify your email."
        }, status=status.HTTP_201_CREATED)


class VerifyEmailView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get('token', '').strip()
        if not token:
            return Response({"error": {"message": "Verification token is required."}}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(verification_token=token)
            user.is_verified = True
            user.verification_token = ""
            user.save(update_fields=['is_verified', 'verification_token'])

            record_audit_event(
                action="AUTH_EMAIL_VERIFIED",
                actor=user,
                target_type="User",
                target_id=str(user.id),
                details={"email": user.email},
                request=request
            )
            return Response({"message": "Email verified successfully."})
        except User.DoesNotExist:
            return Response({"error": {"message": "Invalid or expired verification token."}}, status=status.HTTP_400_BAD_REQUEST)


class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(request=UserLoginSerializer)
    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if not serializer.is_valid():
            email_attempt = request.data.get('email', '')
            record_audit_event(
                action="AUTH_LOGIN_FAILURE",
                actor=None,
                target_type="User",
                target_id=email_attempt,
                details={"reason": "Invalid credentials", "email_attempt": email_attempt},
                request=request
            )
            return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

        user = serializer.validated_data['user']

        # Check 2FA enforcement
        if user.two_factor_enabled:
            totp_code = request.data.get('totp_code')
            if not totp_code:
                return Response({
                    "requires_2fa": True,
                    "message": "Two-factor authentication code required."
                }, status=status.HTTP_200_OK)

            totp = pyotp.TOTP(user.two_factor_secret)
            if not totp.verify(totp_code, valid_window=1):
                record_audit_event(
                    action="AUTH_2FA_FAILURE",
                    actor=user,
                    target_type="User",
                    target_id=str(user.id),
                    details={"reason": "Invalid TOTP code"},
                    request=request
                )
                return Response({
                    "error": {"message": "Invalid two-factor authentication code."}
                }, status=status.HTTP_401_UNAUTHORIZED)

        token, _ = Token.objects.get_or_create(user=user)
        django_login(request, user)

        record_audit_event(
            action="AUTH_LOGIN_SUCCESS",
            actor=user,
            target_type="User",
            target_id=str(user.id),
            details={"email": user.email},
            request=request
        )

        return Response({
            "token": token.key,
            "user": UserDetailSerializer(user).data
        }, status=status.HTTP_200_OK)


class LogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Rotate / invalidate the auth token
        Token.objects.filter(user=request.user).delete()
        django_logout(request)

        record_audit_event(
            action="AUTH_LOGOUT",
            actor=request.user,
            target_type="User",
            target_id=str(request.user.id),
            details={"email": request.user.email},
            request=request
        )

        return Response({"message": "Successfully logged out."})


class ProfileView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: UserDetailSerializer})
    def get(self, request):
        return Response(UserDetailSerializer(request.user).data)

    @extend_schema(request=UserProfileSerializer, responses={200: UserDetailSerializer})
    def patch(self, request):
        user = request.user
        full_name = request.data.get('full_name')
        if full_name is not None:
            user.full_name = full_name.strip()
            user.save(update_fields=['full_name'])

        profile = user.profile
        profile_serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        profile_serializer.is_valid(raise_exception=True)
        profile_serializer.save()

        record_audit_event(
            action="AUTH_PROFILE_UPDATE",
            actor=user,
            target_type="UserProfile",
            target_id=str(profile.id),
            details={"updated_fields": list(request.data.keys())},
            request=request
        )

        return Response(UserDetailSerializer(user).data)


class ChangePasswordView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=ChangePasswordSerializer)
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response(
                {"error": {"message": "Current password is incorrect."}},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(serializer.validated_data['new_password'])
        user.save()

        # Invalidate old token and issue fresh one
        Token.objects.filter(user=user).delete()
        new_token = Token.objects.create(user=user)

        record_audit_event(
            action="AUTH_PASSWORD_CHANGE",
            actor=user,
            target_type="User",
            target_id=str(user.id),
            details={"reason": "User requested password change"},
            request=request
        )

        return Response({
            "message": "Password changed successfully.",
            "token": new_token.key
        })


class TwoFactorSetupView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        # Generate new base32 secret
        secret = pyotp.random_base32()
        user.two_factor_secret = secret
        user.save(update_fields=['two_factor_secret'])

        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name="LifeVault"
        )

        return Response({
            "secret": secret,
            "provisioning_uri": provisioning_uri
        })


class TwoFactorEnableView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=TwoFactorVerifySerializer)
    def post(self, request):
        serializer = TwoFactorVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data['code']

        user = request.user
        if not user.two_factor_secret:
            return Response(
                {"error": {"message": "Please initiate 2FA setup first."}},
                status=status.HTTP_400_BAD_REQUEST
            )

        totp = pyotp.TOTP(user.two_factor_secret)
        if not totp.verify(code, valid_window=1):
            return Response(
                {"error": {"message": "Invalid verification code. Please check your authenticator app."}},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.two_factor_enabled = True
        user.save(update_fields=['two_factor_enabled'])

        record_audit_event(
            action="AUTH_2FA_ENABLED",
            actor=user,
            target_type="User",
            target_id=str(user.id),
            details={},
            request=request
        )

        return Response({"message": "Two-factor authentication successfully enabled."})


class TwoFactorDisableView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        password = request.data.get('password')
        user = request.user

        if not password or not user.check_password(password):
            return Response(
                {"error": {"message": "Valid account password is required to disable 2FA."}},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.two_factor_enabled = False
        user.two_factor_secret = ""
        user.save(update_fields=['two_factor_enabled', 'two_factor_secret'])

        record_audit_event(
            action="AUTH_2FA_DISABLED",
            actor=user,
            target_type="User",
            target_id=str(user.id),
            details={},
            request=request
        )

        return Response({"message": "Two-factor authentication has been disabled."})


class PasswordResetRequestView(views.APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(request=PasswordResetRequestSerializer)
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()

        try:
            user = User.objects.get(email=email)
            reset_token = secrets.token_urlsafe(32)
            user.verification_token = f"reset:{reset_token}"
            user.save(update_fields=['verification_token'])

            # Send email (console backend or SMTP)
            send_mail(
                subject="LifeVault: Password Reset Request",
                message=f"You requested a password reset. Use this token: {reset_token}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True
            )

            record_audit_event(
                action="AUTH_PASSWORD_RESET_REQUEST",
                actor=user,
                target_type="User",
                target_id=str(user.id),
                details={"email": user.email},
                request=request
            )
            # In testing/dev, token is returned for verification
            return Response({
                "message": "If this email exists, a password reset token has been sent.",
                "reset_token": reset_token if settings.DEBUG else None
            })
        except User.DoesNotExist:
            return Response({"message": "If this email exists, a password reset token has been sent."})


class PasswordResetConfirmView(views.APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(request=PasswordResetConfirmSerializer)
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data['token'].strip()

        lookup_token = f"reset:{token}"
        try:
            user = User.objects.get(verification_token=lookup_token)
            user.set_password(serializer.validated_data['new_password'])
            user.verification_token = ""
            user.save()

            Token.objects.filter(user=user).delete()

            record_audit_event(
                action="AUTH_PASSWORD_RESET_SUCCESS",
                actor=user,
                target_type="User",
                target_id=str(user.id),
                details={"email": user.email},
                request=request
            )

            return Response({"message": "Password has been successfully reset. Please log in."})
        except User.DoesNotExist:
            return Response(
                {"error": {"message": "Invalid or expired reset token."}},
                status=status.HTTP_400_BAD_REQUEST
            )


class DeleteAccountView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=DeleteAccountSerializer)
    def post(self, request):
        serializer = DeleteAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data['password']):
            return Response(
                {"error": {"message": "Incorrect password."}},
                status=status.HTTP_400_BAD_REQUEST
            )

        user_id = str(user.id)
        email = user.email

        record_audit_event(
            action="ACCOUNT_DELETED",
            actor=user,
            target_type="User",
            target_id=user_id,
            details={"email": email, "reason": "User confirmed deletion"},
            request=request
        )

        user.delete()
        return Response({"message": "Your vault account and associated data have been permanently deleted."})
