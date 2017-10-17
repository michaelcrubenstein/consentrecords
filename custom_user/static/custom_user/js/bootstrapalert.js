	<!-- Block of code for an alert area at the top of the window -->
<!-- Block of code for an alert area at the top of the window -->
bootstrap_alert = function() {}
bootstrap_alert.panel = null;
bootstrap_alert.timeout = null;
bootstrap_alert.closeOnTimeout = false;
bootstrap_alert.show = function(parentDiv, message, alertClass) {
	bootstrap_alert.closeOnTimeout = false;
	if (bootstrap_alert.timeout)
		clearTimeout(bootstrap_alert.timeout);
	bootstrap_alert.timeout = setTimeout(function()
		{
			bootstrap_alert.timeout = null;
			if (bootstrap_alert.closeOnTimeout &&
				(bootstrap_alert.canClose === undefined || bootstrap_alert.canClose()))
				bootstrap_alert.close();
		}, 1500);
		
	if (bootstrap_alert.panel == null)
	{
		bootstrap_alert.alertClass = alertClass;
		var panel = d3.select('body').append('div')
			.classed('alert', true)
			.classed(alertClass, true)
			.style('z-index', 1000);
		bootstrap_alert.panel = panel.node();
		
		var closeButton = panel.append('button')
			.classed('close', true)
			.attr('aria-hidden', 'true')
			.text('\u00D7');
		$(closeButton.node()).focus();
		panel.selectAll('span')
			.data(message.toString().split('\n'))
			.enter()
			.append('span')
			.html(function(d) { return d; });
		panel.on('click', bootstrap_alert.close);
		$(closeButton.node()).on('focusout', bootstrap_alert.close);
		
		$(bootstrap_alert.panel).offset({top: $(window).innerHeight(), 
										 left: $(bootstrap_alert.panel).css('margin-left')})
			.animate({'top': ($(window).innerHeight() - $(bootstrap_alert.panel).height()) / 3});
	}
	else
	{
		var panel = d3.select(bootstrap_alert.panel);
		
		panel.classed(bootstrap_alert.alertClass, false);
		bootstrap_alert.alertClass = alertClass;
		panel.classed(bootstrap_alert.alertClass, true);
		panel.selectAll('span').remove();
		panel.selectAll('span')
			.data(message.toString().split('\n'))
			.enter()
			.append('span')
			.html(function(d) { return d; });
		$(bootstrap_alert.panel)
			.animate({'top': ($(window).innerHeight() - $(bootstrap_alert.panel).height()) / 3});
	}
}
bootstrap_alert.warning = function(message) {
	bootstrap_alert.show(null, message, "alert-danger");
}
bootstrap_alert.success = function(message) {
	bootstrap_alert.show(null, message, "alert-success");
}
bootstrap_alert.close = function()
{
	if (bootstrap_alert.timeout)
	{
		bootstrap_alert.closeOnTimeout = true;
	}
	else
	{
		if (bootstrap_alert.panel)
		{
			bootstrap_alert.closeOnTimeout = false;
			var panel = bootstrap_alert.panel;
			bootstrap_alert.panel = null;
			$(panel)
				.animate({'left': -$(window).innerWidth()})
				.promise()
				.done(function()
					{
						$(panel).remove();
					});
		}
	}
}

var cr = {}

cr.Queue = (function () {

    Queue.prototype.autorun = true;
    Queue.prototype.running = false;
    Queue.prototype.queue = [];

    function Queue(autorun) {
        if (typeof autorun !== "undefined") {
            this.autorun = autorun;
        }
        this.queue = []; //initialize the queue
    };

    Queue.prototype.add = function (callback) {
        var _this = this;
        //add callback to the queue
        this.queue.push(
        	function () {
				var finished = callback();
				if (typeof finished === "undefined" || finished) {
					//  if callback returns `false`, then you have to 
					//  call `next` somewhere in the callback
					_this.dequeue();
				}
        	}
        );

        if (this.autorun && !this.running) {
            // if nothing is running, then start the engines!
            this.dequeue();
        }

        return this; // for chaining fun!
    };

    Queue.prototype.dequeue = function () {
        this.running = false;
        //get the first element off the queue
        var shift = this.queue.shift();
        if (shift) {
            this.running = true;
            shift();
        }
        return shift;
    };

    Queue.prototype.next = Queue.prototype.dequeue;

    return Queue;

})();

cr.urls = {
		getUserID : "/api/getuserid/",
		getData : "/api/",
		updateValues : "/api/updatevalues/",
		checkUnusedEmail : '/user/checkunusedemail/',
		submitSignout: '/user/submitsignout/',
		submitSignin: '/submitsignin/',
		submitNewUser: '/submitnewuser/',
		updateUsername: '/user/updateusername/',
		updatePassword: '/user/updatepassword/',
		acceptFollower: '/user/acceptFollower/',
		requestAccess: '/user/requestAccess/',
		resetPassword: '/user/resetpassword/',
		setResetPassword: '/user/setresetpassword/',
		log: '/monitor/log/',
	};
	
cr.accessToken = null;
cr.refreshToken = null;
cr.tokenType = null;
	
cr.postError = function(jqXHR, textStatus, errorThrown)
	{
		if (jqXHR.status == 504 || textStatus == "timeout")
			return "This operation ran out of time.";
		else if (jqXHR.status == 403)
			return "Your web page is out of date. You may be able to solve this by reloading the web page.";
		else if (jqXHR.status == 0)
			return "The server is not responding. Please try again.";
		else
			return jqXHR.statusText;
	};

/* Failure of a post event. */
cr.postFailed = function(jqXHR, textStatus, errorThrown, failFunction)
	{
		failFunction(new Error(cr.postError(jqXHR, textStatus, errorThrown)));
	};

/* Failure of an ajax event that throws an error. */
cr.thenFail = function(jqXHR, textStatus, errorThrown)
	{
		var r2 = $.Deferred();
		r2.reject(new Error(cr.postError(jqXHR, textStatus, errorThrown)));
		return r2;
	};

/*	Chain the failure event to be handled subsequently. */
cr.chainFail = function(err)
	{
		var r2 = $.Deferred();
		r2.reject(err);
		return r2;
	};
	
cr._logQueue = new cr.Queue(true)
cr.logRecord = function(name, message)
	{
		cr._logQueue.add(function()
		{
			/* This message is silent and does not record errors. */
			message = message !== undefined ? message : 'None';
			$.post(cr.urls.log,
				   {name: name, message: message })
			.done(function() {cr._logQueue.dequeue()});
			return false;
		});
	}

function syncFailFunction(error)
{
	cr.logRecord('sync fail', error);
	if (typeof(error) == 'object' && 'stack' in error)
		cr.logRecord('sync fail stack', error.stack);
	bootstrap_alert.warning(error, ".alert-container");
	unblockClick();
}

/* A default function used to report an error during an asynchronous operation
	without unblocking a user event. */
function asyncFailFunction(error)
{
	cr.logRecord('async fail', error);
	if (typeof(error) == 'object' && 'stack' in error)
		cr.logRecord('async fail stack', error.stack);
	bootstrap_alert.warning(error, ".alert-container");
	/* Don't unblock here, because there was no block. */
}

cr.syncFail = syncFailFunction;
cr.asyncFail = asyncFailFunction;
		
