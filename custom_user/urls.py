from django.conf.urls import patterns, include, url

from custom_user import views

urlpatterns = patterns(
    '',
    url(r'^checkunusedemail/', views.checkUnusedEmail, name='checkUnusedEmail'),
    url(r'^forgotpassword/', views.forgotPassword, name='forgotPassword'),
    url(r'^newuser/', views.newUser, name='newUser'),
    url(r'^password/', views.password, name='password'),
    url(r'^passwordreset/', views.passwordReset, name='passwordReset'),
    url(r'^resetpassword/', views.resetPassword, name='resetPassword'),
    url(r'^setresetpassword/', views.setResetPassword, name='setResetPassword'),
    url(r'^signin/', views.signin, name='signin'),
    url(r'^signup/', views.signup, name='signup'),
    url(r'^submitsignin/', views.submitsignin, name='submitSignin'),
    url(r'^submitsignout/', views.submitSignout, name='submitSignout'),
    url(r'^updatepassword/', views.updatePassword, name='updatePassword'),
)
