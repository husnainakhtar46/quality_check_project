from django.contrib import admin
from .models import (
    Customer, CustomerEmail, Template, TemplatePOM, Inspection, Measurement, InspectionImage,
    FinalInspection, FinalInspectionDefect, FinalInspectionSizeCheck, FinalInspectionImage
)

admin.site.register(Customer)
admin.site.register(CustomerEmail)
admin.site.register(Template)
admin.site.register(TemplatePOM)
admin.site.register(Inspection)
admin.site.register(Measurement)
admin.site.register(InspectionImage)
admin.site.register(FinalInspection)
admin.site.register(FinalInspectionDefect)
admin.site.register(FinalInspectionSizeCheck)
admin.site.register(FinalInspectionImage)
