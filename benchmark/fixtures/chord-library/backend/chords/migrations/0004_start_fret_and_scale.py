from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("chords", "0003_progression_payload_refactor"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="chordprogression",
            name="start_fret",
            field=models.IntegerField(default=1),
        ),
        migrations.CreateModel(
            name="Scale",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("name", models.CharField(max_length=100)),
                ("root_note", models.CharField(max_length=3)),
                ("scale_type", models.CharField(max_length=50)),
                ("pattern", models.JSONField()),
                ("start_fret", models.IntegerField(default=0, null=True, blank=True)),
                ("difficulty", models.IntegerField(default=1)),
                ("user", models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=django.db.models.deletion.CASCADE, related_name="scales")),
            ],
            options={"db_table": "scales"},
        ),
    ]
