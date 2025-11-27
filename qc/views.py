from rest_framework import viewsets, status, filters
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
    InspectionSerializer, InspectionListSerializer, CustomTokenObtainPairSerializer,
    InspectionCopySerializer
)
from django.db.models import Prefetch

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

def generate_pdf_buffer(inspection):
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    y_pos = height - 50 

    # --- Page 1: Header ---
    p.setFont("Helvetica-Bold", 18)
    p.drawString(50, y_pos, "SAMPLE EVALUATION REPORT")
    y_pos -= 20
    
    # Decision Status
    p.setFont("Helvetica-Bold", 14)
    decision = inspection.decision or "PENDING"
    if decision == "Rejected":
        p.setFillColorRGB(1, 0, 0) 
    elif decision == "Accepted":
        p.setFillColorRGB(0, 0.5, 0)
    elif decision == "Represent":
        p.setFillColorRGB(1, 0.5, 0) # Orange
    else:
        p.setFillColorRGB(0, 0, 0)
        
    p.drawRightString(550, height - 50, f"STATUS: {decision.upper()}")
    p.setFillColorRGB(0, 0, 0)

    # Info Block
    p.setFont("Helvetica", 12)
    y_pos -= 10
    p.drawString(50, y_pos, f"Style: {inspection.style}")
    p.drawString(50, y_pos - 15, f"Color: {inspection.color}")
    p.drawString(50, y_pos - 30, f"PO #: {inspection.po_number}")
    
    p.drawString(300, y_pos, f"Date: {inspection.created_at.strftime('%Y-%m-%d')}")
    p.drawString(300, y_pos - 15, f"Stage: {inspection.stage}")
    p.drawString(300, y_pos - 30, f"Customer: {inspection.customer.name if inspection.customer else 'N/A'}")
    y_pos -= 30

    # Table Header (6 Samples)
    y_pos -= 10
    p.setFont("Helvetica-Bold", 8)
    
    # Coordinates for 6 columns + POM/Tol/Std
    # X-Positions: POM(50), Tol(200), Std(240), S1(280), S2(320), S3(360), S4(400), S5(440), S6(480)
    col_starts = [50, 200, 240, 280, 320, 360, 400, 440, 480]
    
    p.drawString(col_starts[0], y_pos, "POM")
    p.drawString(col_starts[1], y_pos, "Tol")
    p.drawString(col_starts[2], y_pos, "Std")
    p.drawString(col_starts[3], y_pos, "S1")
    p.drawString(col_starts[4], y_pos, "S2")
    p.drawString(col_starts[5], y_pos, "S3")
    p.drawString(col_starts[6], y_pos, "S4")
    p.drawString(col_starts[7], y_pos, "S5")
    p.drawString(col_starts[8], y_pos, "S6")
    
    y_pos -= 2
    p.line(50, y_pos, 550, y_pos)
    y_pos -= 12

    # Measurements Table
    p.setFont("Helvetica", 8)
    for m in inspection.measurements.all():
        # Helper to draw value and apply red color if out of tolerance
        def draw_value(x, value, std, tol):
            val = float(value) if value is not None and value != '' else None
            if val is not None and std is not None and tol is not None:
                if abs(val - std) > tol:
                    p.setFillColorRGB(1, 0, 0) # Red
                else:
                    p.setFillColorRGB(0, 0, 0) # Black
                p.drawString(x, y_pos, str(val))
            else:
                p.setFillColorRGB(0, 0, 0)
                p.drawString(x, y_pos, '-')
        
        p.setFillColorRGB(0, 0, 0)
        pom_display = (m.pom_name[:30] + '..') if len(m.pom_name) > 30 else m.pom_name
        p.drawString(col_starts[0], y_pos, pom_display)
        p.drawString(col_starts[1], y_pos, str(m.tol))
        p.drawString(col_starts[2], y_pos, str(m.std) if m.std is not None else '-')

        draw_value(col_starts[3], m.s1, m.std, m.tol)
        draw_value(col_starts[4], m.s2, m.std, m.tol)
        draw_value(col_starts[5], m.s3, m.std, m.tol)
        draw_value(col_starts[6], m.s4, m.std, m.tol)
        draw_value(col_starts[7], m.s5, m.std, m.tol)
        draw_value(col_starts[8], m.s6, m.std, m.tol)
        
        y_pos -= 12
        if y_pos < 50:
            p.showPage()
            y_pos = height - 50

    p.setFillColorRGB(0, 0, 0)
    
    # --- Comment Sections ---
    y_pos -= 30
    
    def draw_text_block(title, content):
        nonlocal y_pos
        if not content: return
        
        if y_pos < 60:
            p.showPage()
            y_pos = height - 50

        p.setFont("Helvetica-Bold", 10)
        p.drawString(50, y_pos, title)
        y_pos -= 12
        
        p.setFont("Helvetica", 9)
        text_obj = p.beginText(50, y_pos)
        # Simple line splitting for PDF
        import textwrap
        lines = textwrap.wrap(content, width=95) 
        for line in lines:
            if y_pos < 50:
                p.drawText(text_obj)
                p.showPage()
                y_pos = height - 50
                text_obj = p.beginText(50, y_pos)
                text_obj.setFont("Helvetica", 9)
            
            text_obj.textLine(line)
            y_pos -= 12
        
        p.drawText(text_obj)
        y_pos -= 10

    # 1. Customer Remarks
    draw_text_block("Customer Feedback Summary:", inspection.customer_remarks)

    # 2. QA Evaluation Header
    if y_pos < 50:
        p.showPage()
        y_pos = height - 50
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, y_pos, "QA Evaluation:")
    y_pos -= 20

    # 3. Specific Comments
    comments = [
        ("Fit Comments:", inspection.qa_fit_comments),
        ("Workmanship Comments:", inspection.qa_workmanship_comments),
        ("Wash Comments:", inspection.qa_wash_comments),
        ("Fabric Comments:", inspection.qa_fabric_comments),
        ("Accessories Comments:", inspection.qa_accessories_comments),
    ]
    
    for title, text in comments:
        if text:
            draw_text_block(title, text)

    # 4. Final Remarks
    draw_text_block("Final Remarks:", inspection.remarks)

    # --- Page 2: Images ---
    images = inspection.images.all()
    if images.exists():
        p.showPage()
        p.setFont("Helvetica-Bold", 16)
        p.drawString(50, height - 50, "INSPECTION IMAGES")
        
        positions = [
            (50, height - 300), (320, height - 300), 
            (50, height - 550), (320, height - 550)
        ]
        
        for i, img_obj in enumerate(images[:4]):
            if i >= 4: break
            x, y = positions[i]
            try:
                with PILImage.open(img_obj.image.path) as pil_img:
                    if pil_img.mode in ("RGBA", "P"): pil_img = pil_img.convert("RGB")
                    pil_img.thumbnail((800, 800))
                    img_buffer = io.BytesIO()
                    pil_img.save(img_buffer, format='JPEG', quality=60, optimize=True)
                    img_buffer.seek(0)
                    reportlab_img = ImageReader(img_buffer)
                    p.drawImage(reportlab_img, x, y, width=250, height=200, preserveAspectRatio=True)

                p.setFont("Helvetica-Bold", 10)
                p.setFillColorRGB(0, 0, 0)
                caption = img_obj.caption or "Image"
                p.drawString(x, y - 15, caption)
            except Exception as e:
                p.drawString(x, y, "Error loading image")

    p.save()
    buffer.seek(0)
    return buffer

class InspectionViewSet(viewsets.ModelViewSet):
    queryset = Inspection.objects.all()
    serializer_class = InspectionSerializer
    
    filter_backends = [filters.SearchFilter]
    # Added created_by__username to search fields
    search_fields = ['style', 'po_number', 'customer__name', 'created_by__username'] 

    def get_queryset(self):
        queryset = Inspection.objects.select_related('customer', 'template', 'created_by').order_by("-created_at")
        if self.action != 'list' or self.action == 'retrieve':
            queryset = queryset.prefetch_related(
                'measurements', 
                Prefetch('images', queryset=InspectionImage.objects.only('id', 'caption'))
            )
        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return InspectionListSerializer
        if self.action == 'retrieve':
            return InspectionCopySerializer
        return InspectionSerializer

    def perform_create(self, serializer):
        # Save the user who created this report
        serializer.save(created_by=self.request.user)

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
        
        # Separate emails by type (To/CC)
        if inspection.customer:
            to_emails = list(inspection.customer.emails.filter(email_type='to').values_list('email', flat=True))
            cc_emails = list(inspection.customer.emails.filter(email_type='cc').values_list('email', flat=True))
        else:
            to_emails = []
            cc_emails = []
            
        if not to_emails:
             return Response({"error": "No 'To' recipients found. Add at least one 'To' email to the Customer first."}, status=status.HTTP_400_BAD_REQUEST)

        # Updated Subject and Body
        date_str = inspection.created_at.strftime('%Y-%m-%d')
        subject = f"{inspection.customer.name if inspection.customer else 'N/A'} - PO: {inspection.po_number} - Style: {inspection.style} - Color: {inspection.color or 'N/A'} - {date_str} - Decision: {inspection.decision}"
        
        body = (
            f"Dear Team,\n\n"
            f"Please find attached the sample evaluation report against the titled style.\n\n"
            f"Style: {inspection.style}\n"
            f"PO Number: {inspection.po_number}\n"
            f"Stage: {inspection.stage}\n"
            f"Decision: {inspection.decision}\n\n"
            f"Thank you."
        )
        
        buffer = generate_pdf_buffer(inspection)
        email = EmailMessage(subject, body, settings.EMAIL_HOST_USER, to_emails, cc=cc_emails if cc_emails else None)
        email.attach(f"{inspection.style}_{inspection.po_number}_Report.pdf", buffer.getvalue(), "application/pdf")
        email.send(fail_silently=False)
        return Response({"sent": True, "to": to_emails, "cc": cc_emails})

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    @action(detail=True, methods=["post"])
    def add_email(self, request, pk=None):
        customer = self.get_object()
        serializer = CustomerEmailSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(customer=customer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TemplateViewSet(viewsets.ModelViewSet):
    queryset = Template.objects.all()
    serializer_class = TemplateSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'customer__name']

    def get_queryset(self):
        queryset = Template.objects.all()
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        return queryset

class DashboardView(APIView):
    def get(self, request):
        total_inspections = Inspection.objects.count()
        pass_count = Inspection.objects.filter(decision="Accepted").count()
        fail_count = Inspection.objects.exclude(decision="Accepted").count()
        pass_rate = (pass_count / total_inspections * 100) if total_inspections > 0 else 0
        
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