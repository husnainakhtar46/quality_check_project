import re

# Read the file
with open('qc/models.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the CustomerEmail class
old_class = '''class CustomerEmail(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, related_name="emails", on_delete=models.CASCADE)
    email = models.EmailField()

    def __str__(self):
        return f"{self.email} ({self.customer.name})"'''

new_class = '''class CustomerEmail(models.Model):
    EMAIL_TYPE_CHOICES = [
        ('to', 'To'),
        ('cc', 'CC'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, related_name="emails", on_delete=models.CASCADE)
    contact_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField()
    email_type = models.CharField(max_length=2, choices=EMAIL_TYPE_CHOICES, default='to')

    def __str__(self):
        if self.contact_name:
            return f"{self.contact_name} <{self.email}> [{self.get_email_type_display()}] ({self.customer.name})"
        return f"{self.email} [{self.get_email_type_display()}] ({self.customer.name})"'''

# Replace
content = content.replace(old_class, new_class)

# Write back
with open('qc/models.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("CustomerEmail model updated successfully!")
