from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Chord",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("name", models.CharField(max_length=50)),
                ("full_name", models.CharField(max_length=100, blank=True)),
                ("frets", models.JSONField()),
                ("fingers", models.JSONField()),
                ("category", models.CharField(max_length=50, default="major")),
                ("difficulty", models.IntegerField(default=1)),
                ("is_favorite", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=django.db.models.deletion.CASCADE, related_name="chords")),
            ],
            options={
                "db_table": "chords",
            },
        ),
        migrations.AddIndex(
            model_name="chord",
            index=models.Index(fields=["user", "category"], name="chords_user_category_idx"),
        ),
    ]
