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
        
    # Sends a reset password message to the specified email recipient.
    def sendNewFollowerEmail(senderEMail, recipientEMail, follower, acceptURL, ignoreURL):
        htmlMessage = """\
<p>You have received a request to follow your path at pathadvisor.com from %s.</p>
<p>Click <a href="%s">here</a> to accept this follower.</p>
<p>Click <a href="%s">here</a> to ignore this follower.</p>

We hope you enjoy inspiring others by sharing your path.

<b>The PathAdvisor Team</b>
""" % (follower, acceptURL, ignoreURL)

        message = """\
You have received a request to follow your path at pathadvisor.com from %s.

Open the following link in your web browser to accept this follower:

%s

Open the following link in your web browser to ignore this follower:

%s

We hope you enjoy inspiring others by sharing your path.

The PathAdvisor Team
""" % (follower, acceptURL, ignoreURL)
        
        send_mail('A New PathAdvisor Follower', message, senderEMail,
            [recipientEMail], fail_silently=False, html_message=htmlMessage)
    
