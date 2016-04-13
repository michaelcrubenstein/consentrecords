from django.core.mail import send_mail

class Emailer():
    # Sends a reset password message to the specified email recipient.
    def sendResetPasswordEmail(senderEMail, recipientEMail, resetURL):
        htmlMessage = """\
<p>There has been a request to reset your password at pathadvisor.com.</p>
<p>Click <a href="%s">here</a> to reset your password.</p>

<b>The PathAdvisor Team</b>
""" % resetURL

        message = """\
There has been a request to reset your password at pathadvisor.com.
Open the following link in your web browser to reset your password:

%s

Thanks.
The PathAdvisor Team
""" % resetURL
        
        send_mail('Password Reset', message, senderEMail,
            [recipientEMail], fail_silently=False, html_message=htmlMessage)
    
    def merge(html, dir):
        p = re.compile(r'{{\s*([^}\s]+)\s*}}')
        def f(match):
            s = match.group(1)
            if s in dir:
                return dir[s]
            else:
                return s
        return p.sub(f, html)