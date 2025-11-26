import re

# Read the file
with open('qc/views.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the send_email method
old_method = '''    @action(detail=True, methods=["post"])
    def send_email(self, request, pk=None):
        inspection = self.get_object()
        
        # Auto-fetch customer emails
        if inspection.customer:
            to_emails = list(inspection.customer.emails.values_list('email', flat=True))
        else:
            to_emails = []
            
        if not to_emails:
             return Response({"error": "No recipients found. Add emails to the Customer first."}, status=status.HTTP_400_BAD_REQUEST)

        # Updated Subject and Body
        date_str = inspection.created_at.strftime('%Y-%m-%d')
        subject = f"{inspection.customer.name if inspection.customer else 'N/A'} - PO: {inspection.po_number} - Style: {inspection.style} - Color: {inspection.color or 'N/A'} - {date_str} - Decision: {inspection.decision}"
        
        body = (
            f"Dear Team,\\n\\n"
            f"Please find attached the sample evaluation report against the titled style.\\n\\n"
            f"Style: {inspection.style}\\n"
            f"PO Number: {inspection.po_number}\\n"
            f"Stage: {inspection.stage}\\n"
            f"Decision: {inspection.decision}\\n\\n"
            f"Thank you."
        )
        
        buffer = generate_pdf_buffer(inspection)
        email = EmailMessage(subject, body, settings.EMAIL_HOST_USER, to_emails)
        email.attach(f"{inspection.style}_{inspection.po_number}_Report.pdf", buffer.getvalue(), "application/pdf")
        email.send(fail_silently=False)
        return Response({"sent": True, "recipients": to_emails})'''

new_method = '''    @action(detail=True, methods=["post"])
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
            f"Dear Team,\\n\\n"
            f"Please find attached the sample evaluation report against the titled style.\\n\\n"
            f"Style: {inspection.style}\\n"
            f"PO Number: {inspection.po_number}\\n"
            f"Stage: {inspection.stage}\\n"
            f"Decision: {inspection.decision}\\n\\n"
            f"Thank you."
        )
        
        buffer = generate_pdf_buffer(inspection)
        email = EmailMessage(subject, body, settings.EMAIL_HOST_USER, to_emails, cc=cc_emails if cc_emails else None)
        email.attach(f"{inspection.style}_{inspection.po_number}_Report.pdf", buffer.getvalue(), "application/pdf")
        email.send(fail_silently=False)
        return Response({"sent": True, "to": to_emails, "cc": cc_emails})'''

# Replace
content = content.replace(old_method, new_method)

# Write back
with open('qc/views.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Email sending logic updated successfully!")
