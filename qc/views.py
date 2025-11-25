from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from django.core.mail import EmailMessage
from django.conf import settings
from django.http import FileResponse
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from PIL import Image as PILImage
from .models import Customer, CustomerEmail, Template, Inspection, InspectionImage, Measurement
from .serializers import (
    CustomerSerializer, CustomerEmailSerializer, TemplateSerializer, 
    InspectionSerializer, InspectionListSerializer, CustomTokenObtainPairSerializer
)
from django.db.models import Prefetch

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

def generate_pdf_buffer(inspection):
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # --- Page 1: Data & Measurements ---
    
    p.setFont("Helvetica-Bold", 18)
    p.drawString(50, height - 50, "QUALITY INSPECTION REPORT")
    
    # Decision Status
    p.setFont("Helvetica-Bold", 14)
    decision = inspection.decision or "PENDING"
    if decision == "Rejected":
        p.setFillColorRGB(1, 0, 0) 
    elif decision == "Approved":
        p.setFillColorRGB(0, 0.5, 0)
    else:
        p.setFillColorRGB(0, 0, 0)
        
    p.drawRightString(550, height - 50, f"DECISION: {decision.upper()}")
    p.setFillColorRGB(0, 0, 0)

    # Info Block
    p.setFont("Helvetica", 12)
    start_y = height - 80
    p.drawString(50, start_y, f"Style: {inspection.style}")
    p.drawString(50, start_y - 15, f"Color: {inspection.color}")
    p.drawString(50, start_y - 30, f"PO #: {inspection.po_number}")
    
    p.drawString(300, start_y, f"Date: {inspection.created_at.strftime('%Y-%m-%d')}")
    p.drawString(300, start_y - 15, f"Stage: {inspection.stage}")
    p.drawString(300, start_y - 30, f"Customer: {inspection.customer.name if inspection.customer else 'N/A'}")

    # Table Header
    y = start_y - 70
    p.setFont("Helvetica-Bold", 10)
    p.drawString(50, y, "POM")
    p.drawString(250, y, "Tol (+/-)")
    p.drawString(310, y, "Std")
    p.drawString(370, y, "S1")
    p.drawString(430, y, "S2")
    p.drawString(490, y, "S3")
    
    y -= 10
    p.line(50, y, 550, y)
    y -= 15

    # Measurements Table
    p.setFont("Helvetica", 10)
    for m in inspection.measurements.all():
        is_fail = m.status == "FAIL"
        if is_fail:
            p.setFillColorRGB(1, 0, 0) 
        else:
            p.setFillColorRGB(0, 0, 0)
        
        pom_display = (m.pom_name[:35] + '..') if len(m.pom_name) > 35 else m.pom_name
        p.drawString(50, y, pom_display)
        p.drawString(250, y, str(m.tol))
        p.drawString(310, y, str(m.std))
        p.drawString(370, y, str(m.s1 or '-'))
        p.drawString(430, y, str(m.s2 or '-'))
        p.drawString(490, y, str(m.s3 or '-'))
        
        y -= 15
        if y < 50:
            p.showPage()
            y = height - 50

    p.setFillColorRGB(0, 0, 0)
    
    # Remarks
    y -= 20
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, y, "Remarks:")
    p.setFont("Helvetica", 10)
    p.drawString(50, y - 15, inspection.remarks or "None")

    # --- Page 2: Images (Compressed) ---
    images = inspection.images.all()
    if images.exists():
        p.showPage()
        p.setFont("Helvetica-Bold", 16)
        p.drawString(50, height - 50, "INSPECTION IMAGES")
        
        positions = [
            (50, height - 300),  
            (320, height - 300), 
            (50, height - 550),  
            (320, height - 550)
        ]
        
        for i, img_obj in enumerate(images[:4]):
            if i >= 4: break
            
            x, y = positions[i]
            try:
                # --- COMPRESSION LOGIC START ---
                # 1. Open the image using Pillow
                with PILImage.open(img_obj.image.path) as pil_img:
                    
                    # 2. Convert to RGB (Fixes issues with PNG transparency)
                    if pil_img.mode in ("RGBA", "P"):
                        pil_img = pil_img.convert("RGB")
                    
                    # 3. Resize efficiently
                    # We resize to ~800px width. This is high enough quality for 
                    # a small PDF box but drastically smaller in file size than 4000px.
                    pil_img.thumbnail((800, 800))
                    
                    # 4. Save compressed version to memory
                    img_buffer = io.BytesIO()
                    # Quality=60 is the "Sweet Spot" for PDF reports (visually good, tiny file)
                    pil_img.save(img_buffer, format='JPEG', quality=60, optimize=True)
                    img_buffer.seek(0)
                    
                    # 5. Pass the memory buffer to ReportLab
                    reportlab_img = ImageReader(img_buffer)
                    
                    # Draw the image
                    p.drawImage(reportlab_img, x, y, width=250, height=200, preserveAspectRatio=True)
                # --- COMPRESSION LOGIC END ---

                p.setFont("Helvetica-Bold", 10)
                p.setFillColorRGB(0, 0, 0)
                caption = img_obj.caption or "Image"
                p.drawString(x, y - 15, caption)
                
            except Exception as e:
                print(f"Error drawing image: {e}")
                p.drawString(x, y, "Error loading image")

    p.save()
    buffer.seek(0)
    return buffer

class InspectionViewSet(viewsets.ModelViewSet):
    queryset = Inspection.objects.all()
    
    def get_queryset(self):
        queryset = Inspection.objects.select_related('customer', 'template').order_by("-created_at")
        if self.action != 'list':
            queryset = queryset.prefetch_related('measurements', 'images')
        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return InspectionListSerializer
        return InspectionSerializer

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        inspection = self.get_object()
        buffer = generate_pdf_buffer(inspection)
        return FileResponse(buffer, filename=f"{inspection.style}_Report.pdf", content_type="application/pdf")

    @action(detail=True, methods=["post"])
    def upload_image(self, request, pk=None):
        inspection = self.get_object()
        image_file = request.FILES.get("image")
        caption = request.data.get("caption", "Inspection Image")
        
        if not image_file:
            return Response({"error": "No image provided"}, status=status.HTTP_400_BAD_REQUEST)
            
        InspectionImage.objects.create(
            inspection=inspection,
            image=image_file,
            caption=caption
        )
        return Response({"status": "Image uploaded"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def send_email(self, request, pk=None):
        inspection = self.get_object()
        to_emails = request.data.get("recipients", [])
        if not to_emails and inspection.customer:
            to_emails = list(inspection.customer.emails.values_list('email', flat=True))
        
        if not to_emails:
             return Response({"error": "No recipients found."}, status=status.HTTP_400_BAD_REQUEST)

        subject = request.data.get("subject", f"QA Report: {inspection.style}")
        body = request.data.get("body", "Please find attached the report.")
        
        buffer = generate_pdf_buffer(inspection)
        email = EmailMessage(subject, body, settings.EMAIL_HOST_USER, to_emails)
        email.attach(f"{inspection.style}_Report.pdf", buffer.getvalue(), "application/pdf")
        email.send(fail_silently=False)
        return Response({"sent": True})

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

class TemplateViewSet(viewsets.ModelViewSet):
    queryset = Template.objects.all()
    serializer_class = TemplateSerializer

class DashboardView(APIView):
    def get(self, request):
        total_inspections = Inspection.objects.count()
        pass_count = Inspection.objects.filter(decision="Approved").count()
        fail_count = Inspection.objects.filter(decision="Rejected").count()
        pass_rate = (pass_count / total_inspections * 100) if total_inspections > 0 else 0
        
        # Use the optimized serializer for recent inspections too
        recent_inspections = Inspection.objects.select_related('customer', 'template') \
                                               .order_by("-created_at")[:5]
        recent_serializer = InspectionListSerializer(recent_inspections, many=True)

        return Response({
            "total_inspections": total_inspections,
            "pass_count": pass_count,
            "fail_count": fail_count,
            "pass_rate": round(pass_rate, 1),
            "recent_inspections": recent_serializer.data
        })