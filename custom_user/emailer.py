from django.conf import settings
from django.core.mail import send_mail

from django.template import loader

import socket

class Emailer():
    def _send(header, txtMessage, senderEMail, recipients, htmlMessage):
        try:
            send_mail(header, txtMessage, senderEMail,
                recipients, fail_silently=False, html_message=htmlMessage)
        except socket.gaierror as e:
            if e.errno == socket.EAI_NONAME:
                raise RuntimeError('the email can not be sent because the email server is not accessible')
            else:
                raise
        
    # Sends a reset password message to the specified email recipient.
    def sendResetPasswordEmail(recipientEMail, resetURL, hostURL):
        context = {'resetURL': resetURL,
                   'staticURL': hostURL + '/static/',
                  }

        htmlTemplate = loader.get_template('email/resetPassword.html')
        txtTemplate = loader.get_template('email/resetPassword.txt')
        htmlMessage = htmlTemplate.render(context)
        txtMessage = txtTemplate.render(context)

        Emailer._send('Password Reset', txtMessage, settings.PASSWORD_RESET_SENDER,
            [recipientEMail], htmlMessage)
    
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
    def sendRequestExperienceCommentEmail(senderEMail, salutation, recipientEMail, experience, follower, isAdmin, question, comment, hostURL):
        answerURL = hostURL + '/experience/%s/comment/%s/' % (experience.id.hex, comment.id.hex)
        context = {'salutation': " " + salutation if salutation else "", 
                   'asker': follower,
                   'experience': experience.description(),
                   'question': question,
                   'staticURL': hostURL + '/static/',
                   'replyHRef': answerURL}
        s = 'email/requestExperienceComment' + ('Admin' if isAdmin else '')
        htmlTemplate = loader.get_template(s+'.html')
        txtTemplate = loader.get_template(s+'.txt')
        htmlMessage = htmlTemplate.render(context)
        txtMessage = txtTemplate.render(context)
        
        Emailer._send('Path Question From Another User', txtMessage, senderEMail,
            [recipientEMail], htmlMessage)
    
    # Sends a message saying that the specified experiement has a new question to the specified email recipient.
    # following - an instance of the path of the user who owns the experience containing the question.
    def sendAnswerExperienceQuestionEmail(salutation, recipientEMail, experience, following, isAdmin, comment, hostURL):
        experienceHRef = hostURL + '/experience/%s/' % experience.id.hex
        context = {'salutation': salutation, 
                   'following': following.description(),
                   'experience': experience.description(),
                   'question': comment.question,
                   'answer': comment.text,
                   'staticURL': hostURL + '/static/',
                   'experienceHRef': experienceHRef}
        s = 'email/answerExperienceQuestion' + ('Admin' if isAdmin else '')
        htmlTemplate = loader.get_template(s+'.html')
        txtTemplate = loader.get_template(s+'.txt')
        htmlMessage = htmlTemplate.render(context)
        txtMessage = txtTemplate.render(context)
        
        Emailer._send('Your Question Has Been Answered', txtMessage, 
            settings.PASSWORD_RESET_SENDER,
            [recipientEMail], htmlMessage)
    
    # Sends a message saying that the specified experiement has a new question to the specified email recipient.
    def sendSuggestExperienceByTagEmail(salutation, recipientEMail, tag, isAdmin, hostURL):
        answerURL = '%s/add/?m=%s' % (hostURL, tag.description())
        context = {'salutation': " " + salutation if salutation else "", 
                   'tag': tag.description(),
                   'staticURL': hostURL + '/static/',
                   'href': answerURL}
        s = 'email/suggestExperienceByTag' + ('Admin' if isAdmin else '')
        htmlTemplate = loader.get_template(s+'.html')
        txtTemplate = loader.get_template(s+'.txt')
        htmlMessage = htmlTemplate.render(context)
        txtMessage = txtTemplate.render(context)
        
        Emailer._send('A Suggestion from PathAdvisor', txtMessage, settings.PASSWORD_RESET_SENDER,
            [recipientEMail], htmlMessage)
    
    # Sends an email when someone requests to follow the recipient of the email.
    def sendNewFollowerEmail(salutation, recipientEMail, follower, acceptURL, ignoreURL):
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
        
        Emailer._send('A New PathAdvisor Follower', message, settings.PASSWORD_RESET_SENDER,
            [recipientEMail], htmlMessage)
    
