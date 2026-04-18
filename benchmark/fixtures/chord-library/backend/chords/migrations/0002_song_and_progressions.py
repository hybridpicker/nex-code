from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("chords", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Song",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("name", models.CharField(max_length=200)),
                ("artist", models.CharField(max_length=200, blank=True)),
                ("key", models.CharField(max_length=10, blank=True)),
                ("tempo", models.IntegerField(null=True, blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=django.db.models.deletion.CASCADE, related_name="songs")),
            ],
            options={"db_table": "songs"},
        ),
        migrations.CreateModel(
            name="ChordProgression",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("position", models.IntegerField()),
                ("duration", models.IntegerField(default=4)),
                ("section", models.CharField(max_length=50, default="verse")),
                ("name", models.CharField(max_length=50)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("song", models.ForeignKey(to="chords.song", on_delete=django.db.models.deletion.CASCADE, related_name="progressions")),
                ("chord", models.ForeignKey(to="chords.chord", on_delete=django.db.models.deletion.CASCADE, related_name="progressions")),
            ],
            options={"db_table": "chord_progressions"},
        ),
        migrations.AddIndex(
            model_name="chordprogression",
            index=models.Index(fields=["song", "section", "position"], name="progression_song_section_pos_idx"),
        ),
    ]
