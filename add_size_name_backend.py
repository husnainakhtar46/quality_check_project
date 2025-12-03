
import os

# 1. Update qc/models.py
models_path = r"c:\Users\husna\Music\Dapp\quality_check_project\qc\models.py"
with open(models_path, 'r', encoding='utf-8') as f:
    models_content = f.read()

# Add size_name field
# s6 = models.CharField(max_length=50, blank=True)
# size_name = models.CharField(max_length=50, blank=True)

if "size_name = models.CharField" not in models_content:
    models_content = models_content.replace(
        "s6 = models.CharField(max_length=50, blank=True)",
        "s6 = models.CharField(max_length=50, blank=True)\n    size_name = models.CharField(max_length=50, blank=True)"
    )
    with open(models_path, 'w', encoding='utf-8') as f:
        f.write(models_content)
    print("Updated qc/models.py")

# 2. Update qc/serializers.py
serializers_path = r"c:\Users\husna\Music\Dapp\quality_check_project\qc\serializers.py"
with open(serializers_path, 'r', encoding='utf-8') as f:
    serializers_content = f.read()

# Add size_name to fields
# fields = ['id', 'pom_name', 'tol', 'spec', 's1', 's2', 's3', 's4', 's5', 's6']
# fields = ['id', 'pom_name', 'tol', 'spec', 'size_name', 's1', 's2', 's3', 's4', 's5', 's6']

if "'size_name'" not in serializers_content:
    serializers_content = serializers_content.replace(
        "'spec',",
        "'spec', 'size_name',"
    )
    with open(serializers_path, 'w', encoding='utf-8') as f:
        f.write(serializers_content)
    print("Updated qc/serializers.py")
