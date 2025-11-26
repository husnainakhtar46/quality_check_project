import re

# Read the file
with open('qc/serializers.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the CustomerEmailSerializer class
old_serializer = '''class CustomerEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerEmail
        fields = ["id", "email"]'''

new_serializer = '''class CustomerEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerEmail
        fields = ["id", "contact_name", "email", "email_type"]'''

# Replace
content = content.replace(old_serializer, new_serializer)

# Write back
with open('qc/serializers.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("CustomerEmailSerializer updated successfully!")
