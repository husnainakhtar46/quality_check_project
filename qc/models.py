# qc/models.py
import uuid
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return self.name

class CustomerEmail(models.Model):
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
        return f"{self.email} [{self.get_email_type_display()}] ({self.customer.name})"

class Template(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name="templates")

    def __str__(self):
        return self.name

class TemplatePOM(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(Template, related_name="poms", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    default_tol = models.FloatField(default=0.0)
    default_std = models.FloatField(null=True, blank=True) # Changed to allow empty
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.template.name} - {self.name}"

class Inspection(models.Model):
    # Updated Stages
    STAGE_CHOICES = [
        ("Dev", "Dev"), ("Proto", "Proto"), ("Fit", "Fit"),
        ("SMS", "SMS"), ("Size Set", "Size Set"), ("PPS", "PPS"), ("Shipment Sample", "Shipment Sample")
    ]
    # Updated Decisions
    DECISION_CHOICES = [
        ("Accepted", "Accepted"), ("Rejected", "Rejected"), ("Represent", "Represent")
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    style = models.CharField(max_length=255)
    color = models.CharField(max_length=255, blank=True)
    po_number = models.CharField(max_length=255, blank=True)
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default="Proto")
    template = models.ForeignKey(Template, null=True, on_delete=models.SET_NULL)
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL)
    
    # New Specific Comment Fields
    customer_remarks = models.TextField(blank=True, verbose_name="Customer Feedback")
    qa_fit_comments = models.TextField(blank=True, verbose_name="Fit Comments")
    qa_workmanship_comments = models.TextField(blank=True, verbose_name="Workmanship Comments")
    qa_wash_comments = models.TextField(blank=True, verbose_name="Wash Comments")
    qa_fabric_comments = models.TextField(blank=True, verbose_name="Fabric Comments")
    qa_accessories_comments = models.TextField(blank=True, verbose_name="Accessories Comments")

    # General Remarks
    remarks = models.TextField(blank=True, verbose_name="General Remarks")
    
    decision = models.CharField(max_length=20, choices=DECISION_CHOICES, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f"{self.style} - {self.color} ({self.created_at.date()})"

class Measurement(models.Model):
    STATUS_CHOICES = [("OK","OK"), ("FAIL","FAIL")]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inspection = models.ForeignKey(Inspection, related_name="measurements", on_delete=models.CASCADE)
    pom_name = models.CharField(max_length=255)
    tol = models.FloatField(default=0.0)
    std = models.FloatField(null=True, blank=True) # Changed to allow empty
    
    # Expanded to 6 samples
    s1 = models.FloatField(null=True, blank=True)
    s2 = models.FloatField(null=True, blank=True)
    s3 = models.FloatField(null=True, blank=True)
    s4 = models.FloatField(null=True, blank=True)
    s5 = models.FloatField(null=True, blank=True)
    s6 = models.FloatField(null=True, blank=True)
    
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="OK")

    def __str__(self):
        return f"{self.pom_name} - {self.inspection.style}"

class InspectionImage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inspection = models.ForeignKey(Inspection, related_name="images", on_delete=models.CASCADE)
    caption = models.CharField(max_length=100, default="Inspection Image")
    image = models.ImageField(upload_to="inspection_images/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.inspection} - {self.caption}"

class FilterPreset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="filter_presets")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    filters = models.JSONField(default=dict)  # Store filter parameters as JSON
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [["user", "name"]]  # Prevent duplicate names per user

    def __str__(self):
        return f"{self.user.username} - {self.name}"