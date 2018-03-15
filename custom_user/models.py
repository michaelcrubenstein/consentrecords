from django.db import models
from django.core.validators import RegexValidator
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.contrib.auth.models import Group, Permission

import datetime
import uuid

class AuthUserManager(BaseUserManager):
    # create_user is required from a prototype of BaseUserManager
    def create_user(self, email, password=None, firstName=None, lastName=None):
        if not email:
            raise ValueError('Users must have an email address')

        user = self.model(id=uuid.uuid4().hex, email=self.normalize_email(email),
                          )
        user.is_active = True
        user.set_password(password)
        user.first_name = firstName
        user.last_name = lastName
        user.save(using=self._db)
        return user

    # create_superuser is required from a prototype of BaseUserManager
    def create_superuser(self, email, password):
        user = self.create_user(email=email, password=password)
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user
        
    def update_user(self, user, newEmail, newFirstName, newLastName):
        if len(newEmail) == 0:
            newEmail = user.email
        if len(newFirstName) == 0:
            newFirstName = user.first_name
        if len(newLastName) == 0:
            newLastName = user.last_name
        
        self.all().filter(id=user.id).update(email=self.normalize_email(newEmail), first_name=newFirstName, last_name=newLastName);

class AuthUser(AbstractBaseUser, PermissionsMixin):
    alphanumeric = RegexValidator(r'^[0-9a-zA-Z]*$', message='Only alphanumeric characters are allowed.')

    ### Redefine the basic fields that would normally be defined in User ###
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(verbose_name='email address', db_index=True, unique=True, max_length=255)
    first_name = models.CharField(max_length=30, null=True, blank=True)
    last_name = models.CharField(max_length=50, null=True, blank=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True, null=False)
    is_staff = models.BooleanField(default=False, null=False)
    
    objects = AuthUserManager()
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def get_full_name(self):
        return self.first_name+" "+self.last_name if self.first_name else self.email
        
    def get_initials(self):
        return self.first_name[0]+"."+self.last_name[0]+"."

    def get_short_name(self):
        return self.first_name
        
    def updateEmail(self, newEmail):
        self.email = newEmail
        self.save(using=get_user_model().objects._db)

    def __unicode__(self):
        return self.email

class PasswordReset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(verbose_name='email address', max_length=255, db_index=True)
    expiration = models.DateTimeField(db_column='expiration', db_index=True)
    
    class ResetKeyValidError(ValueError):
        def __str__(self):
            return "This reset key is not valid."

    class ResetKeyExpiredError(ValueError):
        def __str__(self):
            return "This reset key is expired."

    class NullPasswordError(ValueError):
        def __str__(self):
            return "The password is zero-length."
    class EmailValidError(ValueError):
        def __str__(self):
            return "This email address is no longer valid."

    def createPasswordReset(email, target=30):
        expiration = target if (type(target) == datetime.datetime) else (datetime.datetime.now() + datetime.timedelta(minutes=target))
        pr = PasswordReset.objects.create(email=email, expiration=expiration)
        return pr.id.hex
        
    def updatePassword(self, email, password):
        if self.email != email:
            PasswordReset.objects.filter(id=self.id).delete()
            raise PasswordReset.ResetKeyValidError();
            
        if datetime.datetime.now() > self.expiration:
            PasswordReset.objects.filter(id=self.id).delete()
            raise PasswordReset.ResetKeyExpiredError()
            
        if len(password) == 0:
            raise PasswordReset.NullPasswordError()
        
        query_set = AuthUser.objects.filter(email=email)
        if query_set.count == 0:
            raise PasswordReset.EmailValidError();
                
        user = query_set.get()
        user.set_password(password)  
        user.save()  
        self.delete()

    def __unicode__(self):
        return self.email + ":" + str(self.expiration)

    def __str__(self):
        return self.email + ":" + str(self.expiration)

