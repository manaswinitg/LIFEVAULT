import pytest
import pyotp
from rest_framework.test import APIClient
from accounts.models import User
from audit.service import verify_audit_chain, record_audit_event
from audit.models import AuditEvent

@pytest.mark.django_db
class TestAuthenticationAndAccounts:

    def setup_method(self):
        self.client = APIClient()

    def test_registration_success_and_duplicate_prevention(self):
        # 1. Successful registration
        payload = {
            "email": "user1@lifevault.local",
            "full_name": "Vault Owner One",
            "password": "SuperSecurePassword123!",
            "password_confirm": "SuperSecurePassword123!"
        }
        res = self.client.post('/api/auth/register/', payload)
        assert res.status_code == 201
        data = res.json()
        assert "token" in data
        assert data["user"]["email"] == "user1@lifevault.local"
        assert data["user"]["full_name"] == "Vault Owner One"
        assert not data["user"]["is_verified"]

        # 2. Duplicate registration attempt should be rejected (400)
        res_dup = self.client.post('/api/auth/register/', payload)
        assert res_dup.status_code == 400

    def test_password_strength_validation(self):
        # Weak password (too short / common)
        payload = {
            "email": "weak@lifevault.local",
            "full_name": "Weak User",
            "password": "123",
            "password_confirm": "123"
        }
        res = self.client.post('/api/auth/register/', payload)
        assert res.status_code == 400

    def test_email_verification_flow(self):
        reg = self.client.post('/api/auth/register/', {
            "email": "verify@lifevault.local",
            "password": "SuperSecurePassword123!",
            "password_confirm": "SuperSecurePassword123!"
        })
        token = reg.json().get("verification_token")
        assert token

        # Verify with token
        verify_res = self.client.post('/api/auth/verify-email/', {"token": token})
        assert verify_res.status_code == 200

        user = User.objects.get(email="verify@lifevault.local")
        assert user.is_verified is True

    def test_login_success_and_failure(self):
        user = User.objects.create_user(
            email="login@lifevault.local",
            password="CorrectPassword123!"
        )

        # 1. Invalid password
        fail_res = self.client.post('/api/auth/login/', {
            "email": "login@lifevault.local",
            "password": "WrongPassword123!"
        })
        assert fail_res.status_code == 401

        # 2. Valid credentials
        success_res = self.client.post('/api/auth/login/', {
            "email": "login@lifevault.local",
            "password": "CorrectPassword123!"
        })
        assert success_res.status_code == 200
        assert "token" in success_res.json()

    def test_two_factor_authentication_workflow(self):
        user = User.objects.create_user(
            email="2fa_user@lifevault.local",
            password="StrongPassword123!"
        )
        self.client.force_authenticate(user=user)

        # 1. Setup 2FA
        setup_res = self.client.post('/api/auth/2fa/setup/')
        assert setup_res.status_code == 200
        secret = setup_res.json()["secret"]
        assert len(secret) > 10

        # 2. Enable 2FA with valid TOTP code
        totp = pyotp.TOTP(secret)
        code = totp.now()
        enable_res = self.client.post('/api/auth/2fa/enable/', {"code": code})
        assert enable_res.status_code == 200

        user.refresh_from_db()
        assert user.two_factor_enabled is True

        # 3. Login now requires 2FA code
        self.client.force_authenticate(user=None)
        login_res = self.client.post('/api/auth/login/', {
            "email": "2fa_user@lifevault.local",
            "password": "StrongPassword123!"
        })
        assert login_res.status_code == 200
        assert login_res.json().get("requires_2fa") is True

        # Complete login with valid TOTP
        valid_totp_code = pyotp.TOTP(secret).now()
        login_2fa_res = self.client.post('/api/auth/login/', {
            "email": "2fa_user@lifevault.local",
            "password": "StrongPassword123!",
            "totp_code": valid_totp_code
        })
        assert login_2fa_res.status_code == 200
        assert "token" in login_2fa_res.json()

    def test_profile_update(self):
        user = User.objects.create_user(
            email="profile@lifevault.local",
            password="StrongPassword123!",
            full_name="Original Name"
        )
        self.client.force_authenticate(user=user)

        res = self.client.patch('/api/auth/profile/', {
            "full_name": "Updated Name",
            "phone": "+1-555-0199",
            "timezone": "America/New_York"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["full_name"] == "Updated Name"
        assert data["profile"]["phone"] == "+1-555-0199"
        assert data["profile"]["timezone"] == "America/New_York"

    def test_password_change_flow(self):
        user = User.objects.create_user(
            email="pwdchange@lifevault.local",
            password="OldPassword123!"
        )
        self.client.force_authenticate(user=user)

        res = self.client.post('/api/auth/change-password/', {
            "old_password": "OldPassword123!",
            "new_password": "NewStrongPassword456!",
            "new_password_confirm": "NewStrongPassword456!"
        })
        assert res.status_code == 200

        # Old password no longer works
        user.refresh_from_db()
        assert not user.check_password("OldPassword123!")
        assert user.check_password("NewStrongPassword456!")

    def test_account_deletion_with_confirmation(self):
        user = User.objects.create_user(
            email="delete_me@lifevault.local",
            password="DeletePass123!"
        )
        self.client.force_authenticate(user=user)

        # Missing exact confirmation text fails
        bad_confirm = self.client.post('/api/auth/delete-account/', {
            "password": "DeletePass123!",
            "confirmation": "DELETE"
        })
        assert bad_confirm.status_code == 400

        # Exact confirmation succeeds
        ok_confirm = self.client.post('/api/auth/delete-account/', {
            "password": "DeletePass123!",
            "confirmation": "DELETE MY VAULT"
        })
        assert ok_confirm.status_code == 200
        assert not User.objects.filter(email="delete_me@lifevault.local").exists()

    def test_audit_chain_integrity_after_auth_events(self):
        user = User.objects.create_user(
            email="chain_user@lifevault.local",
            password="StrongPassword123!"
        )
        # Record two events to form a multi-link chain
        e1 = record_audit_event(
            action="AUTH_LOGIN_SUCCESS",
            actor=user,
            target_type="User",
            target_id=str(user.id),
            details={"ip": "127.0.0.1"}
        )
        e2 = record_audit_event(
            action="AUTH_PROFILE_UPDATE",
            actor=user,
            target_type="UserProfile",
            target_id=str(user.profile.id),
            details={"field": "phone"}
        )
        
        assert AuditEvent.objects.count() == 2
        assert e2.prev_hash == e1.current_hash

        is_valid, broken_id, msg = verify_audit_chain()
        assert is_valid is True
        assert broken_id is None

        # Tampering test: tamper with the first event's current_hash
        e1.current_hash = "tampered_hash_0000000000000000000000000000000000000000000000000000"
        e1.save(update_fields=['current_hash'])

        # Now verify_audit_chain must detect broken link
        tampered_valid, tampered_broken_id, _ = verify_audit_chain()
        assert tampered_valid is False
        assert tampered_broken_id == str(e2.id)
