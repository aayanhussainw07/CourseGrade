from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("grades", "0002_semester_user_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="semester",
            name="background",
            field=models.CharField(default="sunrise", max_length=50),
        ),
    ]
