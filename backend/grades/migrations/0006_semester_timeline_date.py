from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("grades", "0005_alter_course_credits"),
    ]

    operations = [
        migrations.AddField(
            model_name="semester",
            name="timeline_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
