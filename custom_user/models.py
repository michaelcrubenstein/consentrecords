from django.db import models
from django.core.validators import RegexValidator
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.contrib.auth.models import Group, Permission
from django.utils import timezone

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
        if (self.first_name is None):
            fullname = self.email
        else:
            fullname = self.first_name+" "+self.last_name
        return fullname
        
    def get_initials(self):
        return self.first_name[0]+"."+self.last_name[0]+"."

    def get_short_name(self):
        return self.first_name

    def __unicode__(self):
        return self.email

class PasswordReset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(verbose_name='email address', max_length=255, db_index=True)
    creation_time = models.DateTimeField(db_column='creation_time', db_index=True, auto_now_add=True)
    
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

    def createPasswordReset(email):
        PasswordReset.objects.create(email=email)
        return newKey
        
    def updatePassword(self, email, password):
        if self.email != email:
            PasswordReset.objects.filter(id=self.id).delete()
            raise PasswordReset.ResetKeyValidError();
            
        if timezone.now() - datetime.timedelta(minutes=30) > self.creation_time:
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
        return self.email + ":" + str(self.creation_time)

    def __str__(self):
        return self.email + ":" + str(self.creation_time)

