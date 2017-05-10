from django.core.mail import send_mail

from django.template import loader
from consentrecords.models import *

class Emailer():
    # Sends a reset password message to the specified email recipient.
    def sendResetPasswordEmail(recipientEMail, resetURL, hostURL):
        context = {'resetURL': resetURL,
                   'staticURL': hostURL + '/static/',
                  }

        htmlTemplate = loader.get_template('email/resetPassword.html')
        txtTemplate = loader.get_template('email/resetPassword.txt')
        htmlMessage = htmlTemplate.render(context)
        txtMessage = txtTemplate.render(context)

        send_mail('Password Reset', txtMessage, settings.PASSWORD_RESET_SENDER,
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
    def sendRequestExperienceCommentEmail(senderEMail, salutation, recipientEMail, experienceValue, follower, isAdmin, question, commentValue, hostURL):
        answerURL = hostURL + '/experience/%s/comment/%s/' % (experienceValue.idString, commentValue.idString)
        context = {'salutation': " " + salutation if salutation else "", 
                   'asker': follower.getDescription(),
                   'experience': experienceValue.referenceValue.getDescription(),
                   'question': question,
                   'staticURL': hostURL + '/static/',
                   'replyHRef': answerURL}
        s = 'email/requestExperienceComment' + ('Admin' if isAdmin else '')
        htmlTemplate = loader.get_template(s+'.html')
        txtTemplate = loader.get_template(s+'.txt')
        htmlMessage = htmlTemplate.render(context)
        txtMessage = txtTemplate.render(context)
        
        send_mail('Path Question From Another User', txtMessage, senderEMail,
            [recipientEMail], fail_silently=False, html_message=htmlMessage)
    
    # Sends a message saying that the specified experiement has a new question to the specified email recipient.
    # following - an instance of the path of the user who owns the experience containing the question.
    def sendAnswerExperienceQuestionEmail(salutation, recipientEMail, experienceValue, following, isAdmin, comment, hostURL):
        experienceHRef = hostURL + '/experience/%s/' % experienceValue.idString
        context = {'salutation': salutation, 
                   'following': following.getDescription(),
                   'experience': experienceValue.referenceValue.getDescription(),
                   'question': comment.getSubInstance(terms['Comment Request']),
                   'answer': comment.getSubValue(terms.text).stringValue,
                   'staticURL': hostURL + '/static/',
                   'experienceHRef': experienceHRef}
        s = 'email/answerExperienceQuestion' + ('Admin' if isAdmin else '')
        htmlTemplate = loader.get_template(s+'.html')
        txtTemplate = loader.get_template(s+'.txt')
        htmlMessage = htmlTemplate.render(context)
        txtMessage = txtTemplate.render(context)
        
        send_mail('Your Question Has Been Answered', txtMessage, 
            settings.PASSWORD_RESET_SENDER,
            [recipientEMail], fail_silently=False, html_message=htmlMessage)
    
    # Sends a message saying that the specified experiement has a new question to the specified email recipient.
    def sendSuggestExperienceByTagEmail(salutation, recipientEMail, tag, isAdmin, hostURL):
        answerURL = '%s/add/?m=%s' % (hostURL, tag.getDescription())
        context = {'salutation': " " + salutation if salutation else "", 
                   'tag': tag.getDescription(),
                   'staticURL': hostURL + '/static/',
                   'href': answerURL}
        s = 'email/suggestExperienceByTag' + ('Admin' if isAdmin else '')
        htmlTemplate = loader.get_template(s+'.html')
        txtTemplate = loader.get_template(s+'.txt')
        htmlMessage = htmlTemplate.render(context)
        txtMessage = txtTemplate.render(context)
        
        send_mail('A Suggestion from PathAdvisor', txtMessage, settings.PASSWORD_RESET_SENDER,
            [recipientEMail], fail_silently=False, html_message=htmlMessage)
    
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
        
        send_mail('A New PathAdvisor Follower', message, settings.PASSWORD_RESET_SENDER,
            [recipientEMail], fail_silently=False, html_message=htmlMessage)
    
