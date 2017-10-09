var Settings = (function () {
	Settings.prototype = Object.create(EditItemPanel.prototype);
	Settings.prototype.constructor = Settings;

	Settings.prototype.panelTitle = "Settings";
	Settings.prototype.userPublicAccessLabel = "Profile Visibility";
	Settings.prototype.accessRequestLabel = "Access Requests";
	Settings.prototype.pathPublicAccessLabel = "Path Visiblity";
	Settings.prototype.pathSameAccessLabel = "Same As Profile";
	Settings.prototype.pathAlwaysPublicAccessLabel = "Public";
	Settings.prototype.profileHiddenLabel = "Hidden";
	Settings.prototype.emailVisibleLabel = "By Request";
	Settings.prototype.pathVisibleLabel = "Public Path Only";
	Settings.prototype.allVisibleLabel = "Public Profile and Path";
	Settings.prototype.hiddenDocumentation = "No one will be able to locate or identify you.";
	Settings.prototype.byRequestVisibleDocumentation = "Others can request access to your profile if they know your email address.";
	Settings.prototype.pathVisibleDocumentation = "Your path may be found by others, identified only by your screen name. Others can request access to your profile if they know your email address.";
	Settings.prototype.allVisibleDocumentation = "Others can look at your profile and path (except for information you hide from view).";

	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	Settings.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		if (newReveal != this.birthdaySection.editor.wheelReveal &&
			this.birthdaySection.editor.wheelReveal.isVisible())
		{
			this.birthdaySection.editor.hideWheel(done);
			return true;
		}
		else
			return false;
	}
	
	function Settings(controller, onShow) {
		var _this = this;
		EditItemPanel.call(this, controller);
		
		this.createRoot("Settings", onShow, false);
		this.panelDiv.classed("settings", true);

		var firstNameSection = this.appendTextSection(controller.newInstance(), 
			controller.newInstance().firstName, crv.buttonTexts.firstName, 'text');
				 
		var lastNameSection = this.appendTextSection(controller.newInstance(), 
			controller.newInstance().lastName, crv.buttonTexts.lastName, 'text');
		lastNameSection.classed('first', true);
				 
		var screenNameSection = this.appendTextSection(controller.newInstance().path(), 
			controller.newInstance().path().name, crv.buttonTexts.screenName, 'text');
		screenNameSection.classed('first', true);
				 
		var minDate = new Date();
		minDate.setUTCFullYear(minDate.getUTCFullYear() - 100);
		minDate.setMonth(0);
		minDate.setDate(1);

		this.birthdaySection = this.appendDateSection(controller.newInstance(), 
			controller.newInstance().birthday, crv.buttonTexts.birthday, minDate, new Date());
		this.birthdaySection.classed('first', true);
		this.birthdaySection.editor.canShowNotSureReveal = false;
		
		var publicAccessSection = null;
		var publicAccessSectionTextContainer = null;
		
		var user = controller.newInstance();
		var oldUser = controller.oldInstance();
		var path = user.path();
		
		var checkBirthday = function(d, done)
		{
			if (!controller.newInstance().birthday())
			{
				cr.asyncFail(crv.buttonTexts.birthdayRequiredForPublicAccess);
				_this.ensureDateEditorVisible(_this.birthdaySection.editor);
			}
			else if (controller.newInstance().birthday() != controller.oldInstance().birthday())
			{
				_this.promiseUpdateChanges()
					.then(function()
						{
							bootstrap_alert.close();
							done(d);
						},
						cr.asyncFail);
			}
			else
			{
				done(d);
			}
		}
		
		var appendUserActions = function()
		{
			if (oldUser == cr.signedinUser)
			{
				_this.appendActionButton(crv.buttonTexts.changeEmail, function() {
						if (prepareClick('click', 'Change Email'))
						{
							showClickFeedback(this);
							new UpdateUsernamePanel(oldUser)
								.showUp()
								.always(unblockClick);
						}
					});
		
				_this.appendActionButton(crv.buttonTexts.changePassword, function() {
						if (prepareClick('click', 'Change Password'))
						{
							showClickFeedback(this);
							new UpdatePasswordPanel()
								.showUp()
								.always(unblockClick);
						}
					});

				_this.appendActionButton('Sign Out', function() {
						if (prepareClick('click', 'Sign Out'))
						{
							showClickFeedback(this);
							sign_out()
								.then(unblockClick, cr.syncFail);
						}
					})
					.classed('first', true);
			}
		}

		if (oldUser.privilege() === cr.privileges.administer)
		{
			oldUser.promiseData(['user grants', 'group grants'])
				.then(function()
				{
					function accessProperty(newValue)
					{
						if (newValue === undefined)
						{
							var d = {userAccess: this.publicAccess(),
							         pathAccess: this.path().publicAccess()
							        }
							         
							if (d.userAccess == 'read')
								d.name = crv.buttonTexts.userPublic;
							else if (d.pathAccess == 'read')
								d.name = crv.buttonTexts.pathPublic;
							else if (d.userAccess == 'find')
								d.name = crv.buttonTexts.emailPublic;
							else
								d.name = crv.buttonTexts.hidden;
							return d;
						}
						else
						{
							this.publicAccess(newValue.userAccess);
							this.path().publicAccess(newValue.pathAccess);
							this.path().specialAccess(newValue.pathAccess && 'custom');
							updateVisibilityDocumentation(newValue);
						}
					}
					
					var publicAccessSection = 
						_this.appendEnumerationPickerSection(
							controller.newInstance(), accessProperty, crv.buttonTexts.publicAccess, PickUserAccessPanel)
					publicAccessSection.classed('first', true);
					
					var clickFunction = publicAccessSection.on('click');
					publicAccessSection.on('click', function(d)
						{
							checkBirthday(d, function(d)
								{
									clickFunction.call(publicAccessSection.node(), d)
								});
						});			
					var docSection = _this.mainDiv.append('section')
						.classed('cell documentation', true);
			
					var docDiv = docSection.append('div');
			
					var updateVisibilityDocumentation = function(d)
					{
						var documentation;
			
						if (d.userAccess == 'read')
							documentation = _this.allVisibleDocumentation;
						else if (d.pathAccess == 'read')
							documentation = _this.pathVisibleDocumentation;
						else if (d.userAccess == 'find')
							documentation = _this.byRequestVisibleDocumentation;
						else
							documentation = _this.hiddenDocumentation;
						docDiv.text(documentation);
					}
			
					updateVisibilityDocumentation(accessProperty.call(oldUser));
	
					function checkSharingBadge()
					{
						var grs = oldUser.userGrantRequests();
						var badgeCount = (grs && grs.length > 0) ? grs.length : "";

						sharingButton.selectAll("span.badge").text(badgeCount);
					}
			
					var email = oldUser.emails()[0].text();
					var urlSection = _this.mainDiv.append('section')
						.classed('cell edit unique', true)
						.datum(email);
				
					urlSection.append('label')
						.text("Your Path");
					
					var urlList = crf.appendItemList(urlSection);
						
					var urlItem = urlList.append('li')
						.classed('site-active-text', true)
						.append('div')
						.classed('growable unselectable', true)
						.text("{0}/for/{1}"
							.format(window.location.origin, email))
						.on('click', function(d)
							{
								checkBirthday(d, function(d)
									{
										if (prepareClick('click', 'share'))
										{
											try
											{
												new ShareOptions(_this.node(), oldUser);
											}
											catch(err)
											{
												cr.syncFail(err);
											}
										}
									});
							});
					
					setupOnViewEventHandler(oldUser, 'changed.cr', urlItem.node(), 
						function()
						{
							email = oldUser.emails()[0].text();
							urlItem.text("{0}/for/{1}"
								.format(window.location.origin, email));
						});
	
					var sharingDiv = _this.appendActionButton('Sharing', function(d) {
						showClickFeedback(this);
						checkBirthday(d, function(d)
							{
								if (prepareClick('click', 'Sharing'))
								{
									new SharingPanel(controller.oldInstance(), Settings.prototype.panelTitle)
										.showUp()
										.always(unblockClick);
								}
							});

						})
						.classed('first', true);
					var sharingButton = sharingDiv.select('ol>li>div');
					sharingButton.append('span')
						.classed('badge', true);
					checkSharingBadge();
			
					setupOnViewEventHandler(controller.oldInstance(), "userGrantRequestDeleted.cr userGrantRequestAdded.cr", 
						sharingButton.node(), checkSharingBadge);
				
					_this.appendActionButton('Following', function(d)
						{
							showClickFeedback(this);
							checkBirthday(d, function(d)
								{
									if (prepareClick('click', 'Following'))
									{
										new FollowingPanel(oldUser)
											.showUp()
											.always(unblockClick);
									}
								});
						});
				
					appendUserActions();
				});
		}
		else
			appendUserActions(); /* In case the current user isn't their own administrator. */
	}
	
	return Settings;
})();

var PickUserAccessPanel = (function () {
	PickUserAccessPanel.prototype = Object.create(PickFromListPanel.prototype);
	PickUserAccessPanel.prototype.constructor = PickUserAccessPanel;

	PickUserAccessPanel.prototype.title = crv.buttonTexts.publicAccess;
	
	PickUserAccessPanel.prototype.data = function()
	{
		return [{userAccess: '', pathAccess: '', name: crv.buttonTexts.hidden},
				{userAccess: 'find', pathAccess: '', name: crv.buttonTexts.emailPublic},
				{userAccess: 'find', pathAccess: 'read', name: crv.buttonTexts.pathPublic},
				{userAccess: 'read', pathAccess: '', name: crv.buttonTexts.userPublic},
			   ];
	}
	
	PickUserAccessPanel.prototype.isInitialValue = function(d)
	{
		return d.userAccess === this.initialUserPublicAccess &&
			   d.pathAccess === this.initialPathPublicAccess;
	}

	PickUserAccessPanel.prototype.pickedValue = function(d)
	{
		return d;
	}

	PickUserAccessPanel.prototype.datumDescription = function(d)
	{
		return d.name;
	}
	
	PickUserAccessPanel.prototype.getDescription = function(d)
	{
		return d.name;
	}
	
	PickUserAccessPanel.prototype.createRoot = function(user, initialValue)
	{
		this.initialUserPublicAccess = user.publicAccess();
		this.initialPathPublicAccess = user.path().publicAccess();
		return PickFromListPanel.prototype.createRoot.call(this, null, this.title, null);
	}
	
	function PickUserAccessPanel() {
		PickFromListPanel.call(this);
	}
	
	return PickUserAccessPanel;
})();

var ShareOptions = (function () {

	function ShareOptions(panelNode, user)
	{
		var dimmer = new Dimmer(panelNode);
		var panel = d3.select(panelNode).append('panel')
			.classed("confirm", true);

		function onCancel(e)
		{
			if (prepareClick('click', 'Cancel'))
			{
				try
				{
					$(confirmButton.node()).off('blur');
					$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
						$(panel.node()).remove();
						unblockClick();
					});
					clipboard.destroy();
					dimmer.hide();
				}
				catch(err)
				{
					syncFailFunction(err);
				}
			}
			e.preventDefault();
		}
		
		var div = panel.append('div');
		$(div.node()).click(onCancel);
		
		var copyButton = div.append('button')
			.text("Copy Path")
			.classed("site-active-text copy", true)
			.attr('data-clipboard-text', 
			      '{0}/for/{1}'.format(window.location.origin, user.emails()[0].text()));
		
		var clipboard = new Clipboard(copyButton.node());
			
		clipboard.on('error', function(e) {
			cr.asyncFail('Press Ctrl+C to copy');
		});
			
		var confirmButton = div.append('button')
			.text("Share Via Mail")
			.classed("site-active-text", true)
			.on("click", function()
				{
					/* Test case: Email Pathway Link. */
					if (prepareClick('click', "Email Pathway Link"))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							$(panel.node()).remove();
							if (user.id() == cr.signedinUser.id())
							{
								window.location = 'mailto:?subject=My%20Pathway&body=Here is a link to my pathway: {0}/for/{1}.'
											.format(window.location.origin, user.emails()[0].text());
							}
							else
							{
								window.location = 'mailto:?subject=Pathway for {0}&body=Here is a link to the pathway for {0}: {1}/for/{2}.'
											.format(user.caption(), window.location.origin, user.emails()[0].text());
							}
							unblockClick();
						});
						dimmer.hide();
					}
				});
				
		$(confirmButton.node()).on('blur', onCancel);
		var cancelButton = div.append('button')
			.text(crv.buttonTexts.cancel)
			.classed("site-active-text", true);
		
		$(cancelButton.node()).click(onCancel);
		
		dimmer.show();
		$(panel.node()).toggle("slide", {direction: "down", duration: 0});
		$(panel.node()).effect("slide", {direction: "down", duration: 400, complete: 
			function() {
				$(confirmButton.node()).focus();
				unblockClick();
			}});
		dimmer.mousedown(onCancel);
		$(panel.node()).mousedown(function(e)
			{
				e.preventDefault();
			});
	}
	
	return ShareOptions;
})();

var crn = {}

crn.Notification = (function() {
	Notification.prototype.notification = null;
	
	Notification.prototype.appendSpinner = function(buttonNode)
	{
		var child = d3.select(buttonNode).append('span');
		var opts = {
		  lines: 13 // The number of lines to draw
		, length: 4 // The length of each line
		, width: 2 // The line thickness
		, radius: 5 // The radius of the inner circle
		, scale: 0.8 // Scales overall size of the spinner
		, corners: 1 // Corner roundness (0..1)
		, color: '#000' // #rgb or #rrggbb or array of colors
		, opacity: 0.25 // Opacity of the lines
		, rotate: 0 // The rotation offset
		, direction: 1 // 1: clockwise, -1: counterclockwise
		, speed: 1 // Rounds per second
		, trail: 60 // Afterglow percentage
		, fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
		, zIndex: 2e9 // The z-index (defaults to 2000000000)
		, className: 'spinner' // The CSS class to assign to the spinner
		, top: '11px' // Top position relative to parent
		, left: '9px' // Left position relative to parent
		, shadow: false // Whether to render a shadow
		, hwaccel: false // Whether to use hardware acceleration
		, position: 'relative' // Element positioning
		, display: 'inline-block'
		}
		var spinner = new Spinner(opts).spin(child.node());
		child.datum(spinner);
		return child;
	}
	
	Notification.prototype.appendTextSpan = function(buttonNode, spinnerSpan, innerHTML)
	{
		var textSpan = d3.select(buttonNode).append('p')
			.classed('growable unselectable', true);
		
		textSpan.node().innerHTML = innerHTML;
		spinnerSpan.style('display', 'inline-block')
			.style('height', "{0}px".format($(textSpan.node()).height()))
			.style('width', "{0}px".format(16));	/* 16 = The width of the spinner plus 4px padding */
		return textSpan;
	}
	
	function Notification(d)
	{
		this.notification = d;
	}
	
	return Notification;
})();



/* This is a message to inform you that you have been accepted as a follower by another user. */
crn.FollowerAccept = (function() {
	FollowerAccept.prototype = Object.create(crn.Notification.prototype);
	FollowerAccept.prototype.constructor = FollowerAccept;

	FollowerAccept.prototype.buttonText = "<b>{0}</b> has accepted you as a follower.";
	
	FollowerAccept.parseArguments = function(d)
	{
		var user = new cr.User();
		user.setData(d[0]);
		
		return [user];
	}
	
	FollowerAccept.prototype.appendDescription = function(buttonNode, q)
	{
		var args = this.notification.args();
		var user = args[0];
		
		var _this = this;
		var spinnerSpan = this.appendSpinner(buttonNode);
		var textSpan = this.appendTextSpan(buttonNode, spinnerSpan, 
			_this.buttonText.format(""));
		
		q.add(function()
			{
				user.promiseData(['path'])
				 .then(function()
				 	{
						spinnerSpan.datum().stop();
						spinnerSpan.remove();
						textSpan.node().innerHTML = _this.buttonText.format(user.caption());
						$(buttonNode).click(function(e)
							{
								if (prepareClick('click', "Follower Accepted"))
								{
									try
									{
										showClickFeedback(this);
										showUser(user);
									}
									catch(err)
									{
										cr.syncFail(err);
									}
								}
	
								e.preventDefault();
							});
					})
				 .always(function() {q.dequeue()});
				return false;
			});
	}
	
	function FollowerAccept(d)
	{
		crn.Notification.call(this, d);
	}
	
	return FollowerAccept;
})();

/** This notification tells you that another user has asked to follow you.
	Clicking this message takes you to settings.
	
	The arguments are: The path of the user making the request, the experience and the 
		comment instance being requested.
 */
crn.ExperienceCommentRequested = (function() {
	ExperienceCommentRequested.prototype = Object.create(crn.Notification.prototype);
	ExperienceCommentRequested.prototype.constructor = ExperienceCommentRequested;

	ExperienceCommentRequested.prototype.buttonText = "<b>{0}</b> has a question about your {1} experience.";

	ExperienceCommentRequested.parseArguments = function(d)
	{
		var path = new cr.Path();
		path.setData(d[0]);
		
		var experience = new cr.Experience();
		experience.setData(d[1]);
		
		var comment = new cr.Comment();
		comment.setData(d[2]);
		
		return [path, experience, comment];
	}
	
	ExperienceCommentRequested.prototype.appendDescription = function(buttonNode, q)
	{
		var args = this.notification.args();
		var path = args[0];
		
		var _this = this;
		var _this = this;
		var spinnerSpan = this.appendSpinner(buttonNode);
		var textSpan = this.appendTextSpan(buttonNode, spinnerSpan, 
			_this.buttonText.format("", args[1].description()));
		
		q.add(function()
			{
				path.promiseUser()
				 .then(function()
					{
						spinnerSpan.datum().stop();
						spinnerSpan.remove();
						textSpan.node().innerHTML = _this.buttonText.format(path.caption(), args[1].description());
	
						$(buttonNode).click(function(e)
							{
								if (prepareClick('click', "Experience Comment Requested"))
								{
									try
									{
										showClickFeedback(this);
					
										var experienceInstance = crp.getInstance(args[1].id());
										var newPanel = new ExperienceCommentsPanel(new FlagController(experienceInstance), "Notifications");
										$(newPanel.mainDiv).on('revealing.cr', function()
										{
											newPanel.startEditing();
											try 
											{
												newPanel.promise = newPanel.promise.then(function()
													{
														try
														{
															var comments = experienceInstance.comments();
															var commentInstanceID = args[2].id();
															var comment = comments.find(function(v) { return v.id() == commentInstanceID; });
	
															newPanel.focusOnComment(comment.id());
														}
														catch (err) { cr.asyncFail(err); }
													});
											}
											catch(err)
											{
												cr.asyncFail(err);
											}
										});
										newPanel.showLeft()
											.always(unblockClick);
									}
									catch(err)
									{
										cr.syncFail(err);
									}
								}
			
								e.preventDefault();
							});
					},
					cr.asyncFail)
				 .always(function() {q.dequeue(); });
			   return false;
			});
	}
	
    function ExperienceCommentRequested(d)
    {
    	crn.Notification.call(this, d);
    }
    
    return ExperienceCommentRequested;
})();

crn.ExperienceQuestionAnswered = (function() {
	ExperienceQuestionAnswered.prototype = Object.create(crn.Notification.prototype);
	ExperienceQuestionAnswered.prototype.constructor = ExperienceQuestionAnswered;

	ExperienceQuestionAnswered.prototype.buttonText = "<b>{0}</b> has answered a question you asked about their {1} experience.";

	ExperienceQuestionAnswered.parseArguments = function(d)
	{
		var path = new cr.Path();
		path.setData(d[0]);
		
		var experience = new cr.Experience();
		experience.setData(d[1]);
		
		return [path, experience];
	}
	
	ExperienceQuestionAnswered.prototype.appendDescription = function(buttonNode, q)
	{
		var args = this.notification.args();
		var path = args[0];
		
		var _this = this;
		var spinnerSpan = this.appendSpinner(buttonNode);
		var textSpan = this.appendTextSpan(buttonNode, spinnerSpan, 
			_this.buttonText.format("", args[1].description()));
		
		q.add(function()
			{
				$.when(path.promiseUser())
					.then(function()
						{
							spinnerSpan.datum().stop();
							spinnerSpan.remove();
							textSpan.node().innerHTML = _this.buttonText.format(path.caption(), args[1].description());
		
							$(buttonNode).click(function(e)
								{
									if (prepareClick('click', "Experience Question Answered"))
									{
										try
										{
											showClickFeedback(this);
											$.when(path.promiseExperiences())
												.then(function()
													{
														return checkOfferingCells(args[1]);
													})
												.then(function()
													{
														var experienceInstance = crp.getInstance(args[1].id());
														var newPanel = new ExperienceCommentsPanel(new FlagController(experienceInstance), "Notifications");
												
														newPanel.showLeft()
															.always(unblockClick);
													},
													cr.syncFail);
										}
										catch(err)
										{
											cr.syncFail(err);
										}
									}
				
									e.preventDefault();
								});
						},
						cr.asyncFail)
				 .always(function() { q.dequeue(); });
				 return false;
			});
	}
	
    function ExperienceQuestionAnswered(d)
    {
    	crn.Notification.call(this, d);
    }
    
    return ExperienceQuestionAnswered;
})();

crn.ExperienceSuggestion = (function() {
	ExperienceSuggestion.prototype = Object.create(crn.Notification.prototype);
	ExperienceSuggestion.prototype.constructor = ExperienceSuggestion;

	ExperienceSuggestion.prototype.buttonText = "<b>{0}</b> suggests: add {2} with the {1} tag to your path.";

	ExperienceSuggestion.parseArguments = function(d)
	{
		var path = new cr.Path();
		path.setData(d[0]);
		
		var service = new cr.Service();
		service.setData(d[1]);
		
		var comment = new cr.Comment();
		comment.setData(d[2]);
		
		return [path, experience, comment];
	}
	
	ExperienceSuggestion.prototype.appendDescription = function(buttonNode, q)
	{
		var args = this.notification.args();
		var path = args[0];
		var phaseDescription = "an experience" 
		
		var _this = this;
		var spinnerSpan = this.appendSpinner(buttonNode);
		var textSpan = this.appendTextSpan(buttonNode, spinnerSpan, 
			_this.buttonText.format("", args[1].description()), phaseDescription);
		
		q.add(function()
			{
				path.promiseUser()
					.then(function()
						{
							spinnerSpan.datum().stop();
							spinnerSpan.remove();
							textSpan.node().innerHTML = _this.buttonText.format(path.caption(), args[1].description(), phaseDescription);
		
							$(buttonNode).click(function(e)
								{
									if (prepareClick('click', "Experience Suggestion"))
									{
										try
										{
											showClickFeedback(this);
					
											var phase = "Previous";
											var experience = new ExperienceController(cr.signedinUser.path(), null, false)
											experience.initDateRange(phase);
											var tag = crp.getInstance(args[1].id());
											var services = [new ExperienceService()];
											services[0].service(tag);
											experience.experienceServices(services);
											new NewExperiencePanel(experience, revealPanelLeft)
																.showLeft()
																.always(unblockClick);
										}
										catch(err)
										{
											cr.syncFail(err);
										}
									}
				
									e.preventDefault();
								});
						},
						cr.asyncFail)
				 .always(function() { q.dequeue(); });
				 return false;
			});
	}
	
    function ExperienceSuggestion(d)
    {
    	crn.Notification.call(this, d);
    }
    
    return ExperienceSuggestion;
})();

var NotificationsPanel = (function () {
	NotificationsPanel.prototype = Object.create(crv.SitePanel.prototype);
	NotificationsPanel.prototype.constructor = NotificationsPanel;

	NotificationsPanel.prototype.panelTitle = "Notifications";
	NotificationsPanel.prototype.noItemsDescription = "You have no notifications.";
	
	NotificationsPanel.prototype.user = null;
	
	NotificationsPanel.prototype.noItemsDiv = null;
	
	NotificationsPanel.prototype.checkNoItems = function()
	{
		var text = this.noItemsDescription;
		this.noItemsDiv.text(text);
		this.noItemsDiv.style('display', (this.user.notifications().length !== 0) ? 'none' : null);
	}
	
	function NotificationsPanel(user) {
		var _this = this;
		this.user = user;
		
		this.createRoot(null, "NotificationsPanel", "edit notifications", revealPanelUp);

		var navContainer = this.appendNavContainer();

		navContainer.appendTitle(this.panelTitle);
		
		var doneButton = navContainer.appendRightButton();
			
		var panel2Div = this.appendScrollArea();
		
		doneButton.on("click", function()
			{
				if (prepareClick('click', 'done editing'))
				{
					showClickFeedback(this);
					_this.hide();
				}
			})
 			.append("span").text(crv.buttonTexts.done);

		var sections = this.mainDiv.append('section')
		    .datum(user.notifications())
			.classed("cell edit", true)
			.classed("multiple", true);
			
		this.noItemsDiv = sections.append('div')
			.classed('no-results', true)
			.style('display', 'none');

		itemCells = crf.appendItemList(sections)
			.classed('deletable-items', true);
	
		/* Order the items in reverse order. Use splice to copy the array before reversing. */
		var items = appendItems(itemCells, user.notifications().slice().reverse());
		
		items.classed('is-fresh', function(d)
				{
					return d.isFresh() == cr.booleans.yes;
				});

		var deleteControls = crf.appendDeleteControls(items);

		var q = new cr.Queue();
		items.each(function(d)
				{
					var name = d.name();
					if (name && name.indexOf('crn.') != 0)
						name = null;
					
					if (name)
					{
						var f = d.controller();
						if (f)
						{
							new f(d).appendDescription(this, q);
							crf.appendRightChevrons(d3.select(this));
						}
						else
							d3.select(this).text(d.description());
					}
					else
						d3.select(this).text(d.description());
				});
				
		crf.appendConfirmDeleteControls(items);
		crf.showDeleteControls($(deleteControls[0]), 0);
		
		function checkIsFresh()
		{
			try
			{
				var changes = [];
				var scrollParent = $(itemCells.node()).scrollParent();
				var scrollParentTop = scrollParent.offset().top;
				var innerTop = scrollParent.scrollTop();
				var innerBottom = innerTop + scrollParent.innerHeight();
				items.each(function(d)
					{
						var itemTop = $(this).offset().top - scrollParentTop;
						if (itemTop < innerBottom &&
							itemTop >= innerTop)
						{
							if (d.isFresh() == cr.booleans.yes)
								changes.push({id: d.id(), 'is fresh': cr.booleans.no});
						}
					});
				if (changes.length > 0)
				{
					user.update({'notifications': changes})
						.fail(cr.asyncFail);
				}
			}
			catch(err)
			{
				cr.asyncFail(err);
			}
		}
					
		$(panel2Div.node()).on('resize.cr', checkIsFresh);
		$(itemCells.node()).scroll(checkIsFresh);
		
		user.on("notificationDeleted.cr", panel2Div.node(), 
			function() { _this.checkNoItems(); });
		this.checkNoItems();
	}
	
	return NotificationsPanel;
})();

