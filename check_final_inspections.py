import os
import sys
import django

# Add the project directory to the path
sys.path.insert(0, r'c:\Users\husna\Music\Dapp\quality_check_project')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quality_check.settings')

django.setup()

from qc.models import FinalInspection

count = FinalInspection.objects.count()
print(f"Final Inspections in database: {count}")

if count > 0:
    print("\nSample records:")
    for fi in FinalInspection.objects.all()[:3]:
        print(f"  - Order: {fi.order_no}, Style: {fi.style_no}, Result: {fi.result}")
