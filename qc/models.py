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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, related_name="emails", on_delete=models.CASCADE)
    email = models.EmailField()

    def __str__(self):
        return f"{self.email} ({self.customer.name})"

class Template(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return self.name

class TemplatePOM(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(Template, related_name="poms", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    default_tol = models.FloatField(default=0.0)
    default_std = models.FloatField(default=0.0)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.template.name} - {self.name}"

class Inspection(models.Model):
    STAGE_CHOICES = [("Proto","Proto"), ("PPS","PPS"), ("Production","Production")]
    DECISION_CHOICES = [("Approved","Approved"), ("Rejected","Rejected")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    style = models.CharField(max_length=255)
    color = models.CharField(max_length=255, blank=True)
    po_number = models.CharField(max_length=255, blank=True)
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default="PPS")
    template = models.ForeignKey(Template, null=True, on_delete=models.SET_NULL)
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL)
    remarks = models.TextField(blank=True)
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
    std = models.FloatField(default=0.0)
    s1 = models.FloatField(null=True, blank=True)
    s2 = models.FloatField(null=True, blank=True)
    s3 = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="OK")

    def __str__(self):
        return f"{self.pom_name} - {self.inspection.style}"

class InspectionImage(models.Model):
    # Removed TYPE_CHOICES to allow any custom text
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inspection = models.ForeignKey(Inspection, related_name="images", on_delete=models.CASCADE)
    caption = models.CharField(max_length=100, default="Inspection Image") # New field for custom text
    image = models.ImageField(upload_to="inspection_images/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.inspection} - {self.caption}"
