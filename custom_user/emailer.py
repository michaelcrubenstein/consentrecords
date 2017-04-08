from django.core.mail import send_mail

from django.template import Context, loader

class Emailer():
    # Sends a reset password message to the specified email recipient.
    def sendResetPasswordEmail(senderEMail, recipientEMail, resetURL):
        htmlMessage = """\
<p>There has been a request to reset your password at pathadvisor.com.</p>
<p>Click <a href="%s">here</a> to reset your password.</p>

<p><b>The PathAdvisor Team</b></p>
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
        
    # Sends a message saying that the specified experiement has a new question to the specified email recipient.
    def sendRequestExperienceCommentEmail(senderEMail, salutation, recipientEMail, experienceValue, follower, question, commentValue, hostURL):
        answerURL = hostURL + '/experience/%s/comment/%s/' % (experienceValue.id, commentValue.id)
        context = Context({'salutation': " " + salutation if salutation else "", 
                           'asker': follower.getDescription(),
                           'experience': experienceValue.referenceValue.getDescription(),
                           'question': question,
                           'replyHRef': answerURL})
        htmlTemplate = loader.get_template('email/requestExperienceComment.html')
        txtTemplate = loader.get_template('email/requestExperienceComment.txt')
        htmlMessage = htmlTemplate.render(context)
        txtMessage = txtTemplate.render(context)
        send_mail('Path Question From Another User', txtMessage, senderEMail,
            [recipientEMail], fail_silently=False, html_message=htmlMessage)
    
        
        send_mail('Path Question From Another User', message, senderEMail,
            [recipientEMail], fail_silently=False, html_message=htmlMessage)
    
    # Sends a reset password message to the specified email recipient.
    def sendNewFollowerEmail(senderEMail, salutation, recipientEMail, follower, acceptURL, ignoreURL):
        htmlMessage = """<body><style>
    p > span {
    	margin-left: 20px;
    	margin-right: 20px;
    	text-decoration: none;
        cursor: pointer;
        color: #2222FF;
        font-family: "SF-UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
        font-size: 15px;
    }
    p>span>a {
    	text-decoration: none;
        cursor: pointer;
        color: #2222FF;
        font-family: "SF-UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
        font-size: 15px;
    }
</style><p>Hi%s!</p>
<p>You have received a request to follow your path at pathadvisor.com from %s.</p>
<p><span><a href="%s">Accept Request</a></span>
<span><a href="%s">Reject Request</a></span></p>

<p>We hope you discover new opportunities and enjoy inspiring others by sharing your path.</p>

<p><b>The PathAdvisor Team</b></p>
</body>
""" % (" " + salutation if salutation else "", follower, acceptURL, ignoreURL)

        message = """\
You have received a request to follow your path at pathadvisor.com from %s.

Open the following link in your web browser to accept this follower:

%s

Open the following link in your web browser to ignore this follower:

%s

We hope you discover new opportunities and enjoy inspiring others by sharing your path.

The PathAdvisor Team
""" % (follower, acceptURL, ignoreURL)
        
        send_mail('A New PathAdvisor Follower', message, senderEMail,
            [recipientEMail], fail_silently=False, html_message=htmlMessage)
    
