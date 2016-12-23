##################################################################
# Commands to launch the EC2 instance in preparation for running python scripts.
##################################################################

export PEMPATH=~/Development/keys/BeTheChangeProjects.pem
# Start a remote ssh connection with this command.
ssh -i $PEMPATH ubuntu@ec2-52-20-239-27.compute-1.amazonaws.com
