import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from accounts.models import User, UserProfile

@pytest.mark.django_db
def test_health_check_endpoint():
    client = APIClient()
    response = client.get('/api/health/')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'healthy'
    assert data['service'] == 'LifeVault Secure Digital Document Vault'
    assert data['checks']['database'] == 'ok'
    assert data['checks']['storage'] == 'ok'

@pytest.mark.django_db
def test_user_creation_and_profile_signal():
    user = User.objects.create_user(
        email='tester@lifevault.local',
        password='StrongPassword123!',
        full_name='Security Tester'
    )
    assert user.pk is not None
    assert user.email == 'tester@lifevault.local'
    assert user.check_password('StrongPassword123!')
    assert not user.check_password('WrongPassword')
    # Verify UserProfile auto-creation signal
    assert hasattr(user, 'profile')
    assert user.profile.storage_limit_bytes > 0
    assert user.profile.timezone == 'UTC'

@pytest.mark.django_db
def test_openapi_schema_generation():
    client = APIClient()
    response = client.get('/api/schema/')
    assert response.status_code == 200
    # Returns YAML or JSON schema
    assert b'LifeVault API' in response.content or 'LifeVault API' in response.data.get('info', {}).get('title', '')
