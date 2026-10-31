from django.db import migrations

SYSTEM_CATEGORIES = [
    {"name": "identity", "display_name": "Identity & Travel", "description": "Passports, national ID cards, driver licenses, birth certificates.", "icon": "id-card"},
    {"name": "education", "display_name": "Education & Academics", "description": "Diplomas, degree transcripts, certifications, awards.", "icon": "graduation-cap"},
    {"name": "employment", "display_name": "Employment & Career", "description": "Contracts, offer letters, payslips, tax forms.", "icon": "briefcase"},
    {"name": "finance", "display_name": "Finance & Banking", "description": "Bank statements, investment records, loans, tax returns.", "icon": "dollar-sign"},
    {"name": "insurance", "display_name": "Insurance & Healthcare", "description": "Health, vehicle, home insurance policies, medical records.", "icon": "shield-plus"},
    {"name": "property", "display_name": "Property & Housing", "description": "Rental agreements, property deeds, mortgage papers, utility bills.", "icon": "home"},
    {"name": "travel", "display_name": "Travel & Visas", "description": "Visas, flight itineraries, hotel bookings, travel insurance.", "icon": "plane"},
    {"name": "warranty", "display_name": "Warranties & Receipts", "description": "Appliance warranties, purchase invoices, equipment manuals.", "icon": "tag"},
    {"name": "other", "display_name": "Other Personal Records", "description": "Miscellaneous important household and personal files.", "icon": "folder"},
]

def seed_categories(apps, schema_editor):
    DocumentCategory = apps.get_model('documents', 'DocumentCategory')
    for cat in SYSTEM_CATEGORIES:
        DocumentCategory.objects.get_or_create(
            name=cat['name'],
            defaults={
                'display_name': cat['display_name'],
                'description': cat['description'],
                'icon': cat['icon'],
                'is_system': True
            }
        )

def unseed_categories(apps, schema_editor):
    DocumentCategory = apps.get_model('documents', 'DocumentCategory')
    DocumentCategory.objects.filter(is_system=True).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_categories, unseed_categories),
    ]
