from django.contrib import admin
from .models import Customer, CustomerEmail, Template, TemplatePOM, Inspection, Measurement, InspectionImage

admin.site.register(Customer)
admin.site.register(CustomerEmail)
admin.site.register(Template)
admin.site.register(TemplatePOM)
admin.site.register(Inspection)
admin.site.register(Measurement)
admin.site.register(InspectionImage)
