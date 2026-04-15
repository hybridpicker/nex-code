from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("chords", "0002_song_and_progressions"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="chordprogression",
            name="chord",
        ),
        migrations.AddField(
            model_name="chordprogression",
            name="full_name",
            field=models.CharField(max_length=100, blank=True),
        ),
        migrations.AddField(
            model_name="chordprogression",
            name="frets",
            field=models.JSONField(default=list),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="chordprogression",
            name="fingers",
            field=models.JSONField(default=list),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="chordprogression",
            name="chord_notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="chordprogression",
            name="context_notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="chordprogression",
            name="source_chord",
            field=models.ForeignKey(
                to="chords.chord",
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
                related_name="used_in_progressions",
            ),
        ),
    ]
