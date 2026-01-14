from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("grades", "0006_semester_timeline_date"),
    ]

    operations = [
        migrations.AddField(
            model_name="course",
            name="percent_boost",
            field=models.FloatField(
                default=0,
                validators=[
                    django.core.validators.MinValueValidator(0),
                    django.core.validators.MaxValueValidator(100),
                ],
            ),
        ),
    ]
