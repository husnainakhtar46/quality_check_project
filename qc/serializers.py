# qc/serializers.py
from rest_framework import serializers
from .models import Customer, CustomerEmail, Template, TemplatePOM, Inspection, Measurement, InspectionImage
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['username'] = self.user.username
        data['is_superuser'] = self.user.is_superuser
        return data

class CustomerEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerEmail
        fields = ["id", "email"]

class CustomerSerializer(serializers.ModelSerializer):
    emails = CustomerEmailSerializer(many=True, read_only=True)
    class Meta:
        model = Customer
        fields = ["id", "name", "created_at", "emails"]

class TemplatePOMSerializer(serializers.ModelSerializer):
    class Meta:
        model = TemplatePOM
        fields = ["id", "name", "default_tol", "default_std", "order"]

class TemplateSerializer(serializers.ModelSerializer):
    poms = TemplatePOMSerializer(many=True)
    class Meta:
        model = Template
        fields = ["id", "name", "description", "created_at", "poms"]

    def create(self, validated_data):
        poms_data = validated_data.pop("poms", [])
        template = Template.objects.create(**validated_data)
        for i, pom in enumerate(poms_data):
            TemplatePOM.objects.create(template=template, order=i, **pom)
        return template

    def update(self, instance, validated_data):
        poms_data = validated_data.pop("poms", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if poms_data is not None:
            instance.poms.all().delete()
            for i, pom in enumerate(poms_data):
                TemplatePOM.objects.create(template=instance, order=i, **pom)
        return instance

class MeasurementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Measurement
        fields = ["id","pom_name","tol","std","s1","s2","s3","status"]

class InspectionImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionImage
        # --- FIX IS HERE: Changed 'type' to 'caption' ---
        fields = ["id","caption","image","uploaded_at"]

class InspectionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Inspection
        fields = [
            "id","style","color","po_number","stage","template","customer",
            "remarks","decision","created_at"
        ]

class InspectionSerializer(serializers.ModelSerializer):
    measurements = MeasurementSerializer(many=True)
    images = InspectionImageSerializer(many=True, read_only=True)
    class Meta:
        model = Inspection
        fields = [
            "id","style","color","po_number","stage","template","customer",
            "remarks","decision","created_at","measurements","images"
        ]

    def create(self, validated_data):
        measurements_data = validated_data.pop("measurements", [])
        inspection = Inspection.objects.create(**validated_data)
        for m in measurements_data:
            Measurement.objects.create(inspection=inspection, **m)
        return inspection

    def update(self, instance, validated_data):
        measurements_data = validated_data.pop("measurements", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if measurements_data is not None:
            instance.measurements.all().delete()
            for m in measurements_data:
                Measurement.objects.create(inspection=instance, **m)
        return instance