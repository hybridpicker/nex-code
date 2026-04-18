from django.conf import settings
from django.db import models
import uuid


class Chord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chords")
    name = models.CharField(max_length=50)
    full_name = models.CharField(max_length=100, blank=True)
    frets = models.JSONField()
    fingers = models.JSONField()
    chord_notes = models.TextField(blank=True)
    tensions = models.TextField(blank=True)
    category = models.CharField(max_length=50, default="major")
    difficulty = models.IntegerField(default=1)
    is_favorite = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chords"
        indexes = [
            models.Index(fields=["user", "is_favorite"]),
            models.Index(fields=["user", "category"]),
        ]


class Song(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="songs")
    name = models.CharField(max_length=200)
    artist = models.CharField(max_length=200, blank=True)
    key = models.CharField(max_length=10, blank=True)
    tempo = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ChordProgression(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    song = models.ForeignKey(Song, on_delete=models.CASCADE, related_name="progressions")
    name = models.CharField(max_length=50)
    full_name = models.CharField(max_length=100, blank=True)
    frets = models.JSONField()
    fingers = models.JSONField()
    position = models.IntegerField()
    duration = models.IntegerField(default=4)
    section = models.CharField(max_length=50, default="verse")
    chord_notes = models.TextField(blank=True)
    context_notes = models.TextField(blank=True)
    start_fret = models.IntegerField(default=1)
    source_chord = models.ForeignKey(
        Chord,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="used_in_progressions",
    )

    class Meta:
        db_table = "chord_progressions"
        indexes = [
            models.Index(fields=["song", "section", "position"]),
        ]


class Scale(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="scales")
    name = models.CharField(max_length=100)
    root_note = models.CharField(max_length=3)
    scale_type = models.CharField(max_length=50)
    pattern = models.JSONField()
    start_fret = models.IntegerField(default=0, null=True, blank=True)
    difficulty = models.IntegerField(default=1)


class PracticeIdea(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="practice_ideas")
    song = models.ForeignKey(Song, on_delete=models.SET_NULL, null=True, blank=True, related_name="ideas")
    content = models.TextField()
    idea_type = models.CharField(max_length=20, default="other")
    is_resolved = models.BooleanField(default=False)
