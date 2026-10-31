import pytest
from datetime import date, timedelta
from rest_framework.test import APIClient
from accounts.models import User
from documents.models import Document
from reminders.models import DocumentReminder, Notification
from reminders.tasks import check_document_expiries

@pytest.mark.django_db
class TestRemindersAndNotifications:

    def setup_method(self):
        self.user = User.objects.create_user(email="reminder_user@lifevault.local", password="StrongPassword123!")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_upcoming_expirations_and_reminders_crud(self):
        # Create doc expiring in 15 days
        doc = Document.objects.create(
            owner=self.user,
            title="Auto Insurance Policy",
            original_filename="policy.pdf",
            mime_type="application/pdf",
            expiry_date=date.today() + timedelta(days=15)
        )

        # 1. Upcoming list returns document
        upcoming_res = self.client.get('/api/reminders/upcoming/')
        assert upcoming_res.status_code == 200
        assert len(upcoming_res.json()) >= 1
        assert upcoming_res.json()[0]['id'] == str(doc.id)

        # 2. Configure reminder
        rem_res = self.client.post('/api/reminders/', {
            'document_id': str(doc.id),
            'reminder_days_before': 7
        })
        assert rem_res.status_code == 201
        reminder_id = rem_res.json()['id']

        # 3. Resolve reminder
        resolve_res = self.client.post(f'/api/reminders/{reminder_id}/resolve/')
        assert resolve_res.status_code == 200
        assert resolve_res.json()['is_resolved'] is True

    def test_celery_expiry_checker_and_duplicate_prevention(self):
        # Create document expiring in exactly 7 days
        doc = Document.objects.create(
            owner=self.user,
            title="Passport Renewal Alert",
            original_filename="passport.pdf",
            mime_type="application/pdf",
            expiry_date=date.today() + timedelta(days=7)
        )

        # 1. First run of background task should create 1 notification
        result_1 = check_document_expiries()
        assert result_1['notifications_dispatched'] == 1

        notifs = Notification.objects.filter(user=self.user, document=doc)
        assert notifs.count() == 1
        assert not notifs.first().is_read
        assert "7 days" in notifs.first().title

        # 2. Running task a second time (e.g. task retry or repeated cron trigger) MUST NOT duplicate notifications!
        result_2 = check_document_expiries()
        assert result_2['notifications_dispatched'] == 0
        assert Notification.objects.filter(user=self.user, document=doc).count() == 1

    def test_notification_center_read_workflows(self):
        # Create two notifications
        n1 = Notification.objects.create(
            user=self.user,
            title="Alert 1",
            message="Message 1",
            deduplication_key="key_1"
        )
        n2 = Notification.objects.create(
            user=self.user,
            title="Alert 2",
            message="Message 2",
            deduplication_key="key_2"
        )

        # 1. Verify unread count is 2
        center_res = self.client.get('/api/reminders/notifications/')
        assert center_res.status_code == 200
        assert center_res.json()['unread_count'] == 2

        # 2. Mark one as read
        self.client.post(f'/api/reminders/notifications/{n1.id}/read/')
        assert self.client.get('/api/reminders/notifications/').json()['unread_count'] == 1

        # 3. Mark all as read
        self.client.post('/api/reminders/notifications/read-all/')
        assert self.client.get('/api/reminders/notifications/').json()['unread_count'] == 0
