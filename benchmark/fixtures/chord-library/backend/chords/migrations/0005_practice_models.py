from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("chords", "0004_start_fret_and_scale"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PracticeIdea",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("content", models.TextField()),
                ("idea_type", models.CharField(max_length=20, default="other")),
                ("is_resolved", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("song", models.ForeignKey(to="chords.song", on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, related_name="ideas")),
                ("user", models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=django.db.models.deletion.CASCADE, related_name="practice_ideas")),
            ],
            options={"db_table": "practice_ideas"},
        ),
        migrations.AddIndex(
            model_name="practiceidea",
            index=models.Index(fields=["user", "is_resolved"], name="practice_idea_user_resolved_idx"),
        ),
    ]
