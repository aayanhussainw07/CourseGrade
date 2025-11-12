from django.db import migrations, models


def set_default_user_id(apps, schema_editor):
    Semester = apps.get_model("grades", "Semester")
    Semester.objects.filter(user_id__isnull=True).update(user_id="default")


class Migration(migrations.Migration):
    dependencies = [
        ("grades", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="semester",
            name="user_id",
            field=models.CharField(db_index=True, default="default", max_length=255),
        ),
        migrations.RunPython(set_default_user_id, migrations.RunPython.noop),
    ]
