# Script for sending an email that announces a request has been completed.


import django; django.setup()

from consentrecords.models import *
from consentrecords import pathparser
from custom_user.emailer import Emailer

hostURL = 'http://127.0.0.1:8000/b'
senderEMail = 'no-reply@pathadvisor.com'
recipientEMail = 'michaelcrubenstein@gmail.com'
askerEMail = 'testuser28@pathadvisor.com'
salutation = 'Michael Rubenstein'

following = pathparser.getQuerySet('user[email=%s]'%askerEMail)[0]
followingPath = following.getSubInstance(terms['Path'])
experiences = pathparser.getQuerySet('user[email=%s]/Path/More Experience[Comments[Comment[text][Comment Request[Path=%s]]]]'\
    %(recipientEMail, followingPath.id))

experienceValue = experiences[0].parentValue

commentsList = experiences[0].getSubInstance(terms['Comments'])
comments = commentsList.value_set.filter(field=terms['Comment'],deleteTransaction__isnull=True)
comments = comments.filter(referenceValue__value__field=terms['Comment Request'],
    referenceValue__value__referenceValue__value__referenceValue=followingPath.id,
    referenceValue__value__referenceValue__value__deleteTransaction__isnull=True)
comments = comments.filter(referenceValue__value__field=terms['text'],
    referenceValue__value__deleteTransaction__isnull=True)
comment = comments[0].referenceValue

Emailer.sendAnswerExperienceQuestionEmail(senderEMail, salutation, recipientEMail, experienceValue, following, comment, hostURL)
