/* RequestFollowPanel is used to specify the email address of a user the currently logged-in
	user wants to follow. */
var RequestFollowPanel = (function() {
	RequestFollowPanel.prototype = Object.create(crv.SitePanel.prototype);
	RequestFollowPanel.prototype.constructor = RequestFollowPanel;

	RequestFollowPanel.prototype.followingPanel = null;
	RequestFollowPanel.prototype.title = "Ask to Follow";
	RequestFollowPanel.prototype.emailDocumentation = 
		'If you know the email address of someone you want to follow, you can request access to their profile.';
	RequestFollowPanel.prototype.badEmailMessage =
		'Please specify a valid email address.';
	
	function RequestFollowPanel(user, followingPanel) {
		var _this = this;
		this.followingPanel = followingPanel;
		this.createRoot(null, this.title, "list", revealPanelUp);
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on('click', function()
				{
					if (prepareClick('click', 'Cancel {0}'.format(_this.title)))
					{
						_this.hide();
					}
				})
			.text('Cancel');
		
		navContainer.appendTitle(this.title);
		
		navContainer.appendRightButton()
			.on('click', function()
			{
				if (prepareClick('click', 'request to follow user'))
				{
					var done = function()
					{
						_this.followingPanel.showPendingObjects([
							{text: email, description: function() { return email; }}]);
						_this.followingPanel._pendingSection.selectAll('li').sort(
							function(a, b)
							{
								return a.description().localeCompare(b.description());
							}
						);
						_this.followingPanel._noPendingResultsDiv.style('display', 'none');
						_this.hide();
						bootstrap_alert.success("Access to {0} has been requested.".format(email));
					}
					
					try
					{
						var email = d3.select(_this.node()).selectAll('input').node().value;
						function validateEmail(email) 
						{
							var re = /\S+@\S+\.\S\S+/;
							return re.test(email);
						}
						
						if (!validateEmail(email))
						{
							syncFailFunction(_this.badEmailMessage);
						}
						else
						{
							cr.requestAccess(user, 'user[email>text="{0}"]'.format(email), done, syncFailFunction);
						}
					}
					catch(err)
					{
						syncFailFunction(err);
					}
				}
				d3.event.preventDefault();
			})
		    .text("Request");
		
		var panel2Div = this.appendScrollArea();
			
		var docSection = panel2Div.append('section')
			.classed('cell documentation', true);
			
		var docDiv = docSection.append('div')
			.text(this.emailDocumentation);

		var sectionView = new EditItemSectionView(this, user);
			
		var itemsDiv = sectionView.appendItemList();

		var divs = itemsDiv.append('li');	// So that each item appears on its own row.
			
		this.emailInput = divs.append('input')
			.classed('growable', true)
			.attr('type', 'email')
			.attr('placeholder', "Email");
	}
	
	return RequestFollowPanel;
})();

var FollowingSearchView = (function() {
	FollowingSearchView.prototype = Object.create(SearchOptionsView.prototype);
	FollowingSearchView.prototype.constructor = FollowingSearchView;
	
	FollowingSearchView.prototype.onClickButton = function(user, i, button) {
		if (prepareClick('click', 'user: ' + user.description()))
		{
			try
			{
				showClickFeedback(button);
				showUser(user);
			}
			catch (err) { cr.syncFail(err); }
		}
		d3.event.preventDefault();
		d3.event.stopPropagation();
	}

	FollowingSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		return true;
	}
	
	FollowingSearchView.prototype.searchPath = function(val)
	{
		return 'user[user grant>grantee={0}]'.format(this.user.id());
	}
	
	/* Overwrite this function to use a different set of fields for the getData or selectAll operation
		sent to the middle tier.
	 */
	FollowingSearchView.prototype.fields = function()
	{
		return ['none'];
	}
	
	FollowingSearchView.prototype.resultType = function()
	{
		return cr.User;
	}
	
	FollowingSearchView.prototype.noResultString = function()
	{
		return crv.buttonTexts.none;
	}
	
	FollowingSearchView.prototype.fillItems = function(items)
	{
		var _this = this;
		SearchOptionsView.prototype.fillItems.call(this, items);
		
		items.append('button')
			.classed('compare-button', true)
			.on('click', function(user) {
				if (prepareClick('click', 'compare to: ' + user.description()))
				{
					user.promiseData(['path'])
						.then(function()
						{
							try
							{
								new ComparePathsPanel(_this.user, user)
									.showUp()
									.always(unblockClick);
							}
							catch(err)
							{
								cr.syncFail(err);
							}
						},
						cr.syncFail);
				}
				d3.event.preventDefault();
				d3.event.stopPropagation();
			})
			.append('img')
			.attr('src', compareImagePath);

		crf.appendRightChevrons(items);
	}
	
	FollowingSearchView.prototype.appendSearchArea = function()
	{
		return this.sectionView.appendItemList()
			.classed('hover-items deletable-items', true);
	}
	
	FollowingSearchView.prototype.inputText = function(val)
	{
		return "";
	}
	

	function FollowingSearchView(sectionView, user)
	{
		this.user = user;
		SearchOptionsView.call(this, sectionView);
	}
	
	return FollowingSearchView;
})();

/* FollowingPanel is used to identify and manage the users that the currently logged-in
	user is following. */
var FollowingPanel = (function() {
	FollowingPanel.prototype = Object.create(crv.SitePanel.prototype);
	FollowingPanel.prototype.constructor = FollowingPanel;

	FollowingPanel.prototype.user = null;
	FollowingPanel.prototype._pendingSection = null;
	FollowingPanel.prototype._noPendingResultsDiv = null;
	FollowingPanel.prototype._foundPendingRequests = null;
	FollowingPanel.prototype._followingSection = null;
	FollowingPanel.prototype._noFollowingResultsDiv = null;
	FollowingPanel.prototype._foundFollowingRequests = null;
	
	FollowingPanel.prototype.showPendingObjects = function(foundObjects)
	{
		var _this = this;
		var items = this._pendingChunker.appendButtonContainers(foundObjects);
		crf.appendDeleteControls(items);
		this._followingSection.appendButtonDescriptions(items);
		crf.appendConfirmDeleteControls(items, function(d)
			{
				var _thisItem = $(this).parents('li')[0];
				if (prepareClick('click', 'delete access request'))
				{
					var path;
					if (d.id)
						path = 'user/' + d.id()
					else
						path = 'user[email>text={0}]'.format(d.description())
					path += '/user grant request[grantee={0}]'.format(_this.user.id());
					cr.getData({path: path, fields: ['parents'], resultType: cr.UserUserGrantRequest})
						.then(function(grantRequests)
							{
								if (grantRequests.length > 0)
								{
									grantRequests[0].deleteData()
										.then(
										function()
										{
											removeItem(_thisItem,
												function()
												{
													_this._foundPendingRequests.splice(_this._foundPendingRequests.indexOf(d), 1);
													_this._noPendingResultsDiv.style('display', _this._foundPendingRequests.length === 0 ? null : 'none');
													unblockClick();
												});
										},
										cr.syncFail);
								}
								else
									cr.syncFail("Error: this access request was not found");
							},
							cr.syncFail);
				}
			});
		this.checkDeleteControlVisibility(items);
		
		return items;
	}

	FollowingPanel.prototype.checkDeleteControlVisibility = function(items)
	{
		var deleteControls = $(items.node()).parent().find('button.delete');
		if (!this.inEditMode)
			crf.hideDeleteControls(deleteControls, 0);
		else
			crf.showDeleteControls(deleteControls, 0);
	}
	
	FollowingPanel.prototype.getPendingRequestsDone = function(foundObjects, startVal)
	{
		if (this._foundPendingRequests === null)
			this._foundPendingRequests = foundObjects;
		else
			this._foundPendingRequests = this._foundPendingRequests.concat(foundObjects);
		this.showPendingObjects(foundObjects);
		this._noPendingResultsDiv.style('display', this._foundPendingRequests.length === 0 ? null : 'none');
		return true;
	}
	
	function FollowingPanel(user) {
		var header = "Following";
		this.user = user;
		this.createRoot(null, header, "edit following", revealPanelLeft);
		var navContainer = this.appendNavContainer();
		
		var backButton = navContainer.appendLeftButton()
			.classed('chevron-left-container', true)
			.on('click', function()
			{
				if (prepareClick('click', 'Back'))
				{
					_this.hide();
				}
				d3.event.preventDefault();
			});
		appendLeftChevronSVG(backButton).classed('site-active-text chevron-left', true);
		backButton.append('span').text("Settings");
		
		navContainer.appendTitle(header);
		
		var _this = this;	
		this.inEditMode = false;
		var editButton = navContainer.appendRightButton()
			.on('click', function()
			{
				var dials = $(_this.node()).find('ol.deletable-items>li>button:first-of-type');
				if (_this.inEditMode)
				{
					showClickFeedback(this, function()
						{
							editButton.text(crv.buttonTexts.edit);
							_this.navContainer.centerTitle();
						});
					if (prepareClick('click', 'Done Edit Following'))
					{
						crf.hideDeleteControls(dials);
						_this.inEditMode = false;
						unblockClick();
					}
				}
				else
				{
					if (prepareClick('click', 'Edit Following'))
					{
						showClickFeedback(this, function()
							{
								editButton.text(crv.buttonTexts.done);
								_this.navContainer.centerTitle();
							});
						crf.showDeleteControls(dials);
						_this.inEditMode = true;
						unblockClick();
					}
				}
			});
		editButton.text(crv.buttonTexts.edit);
		
		var panel2Div = this.appendScrollArea();
		
		this._pendingSection = new UserSectionView(this, user);

		this._pendingSection.appendLabel("Pending Requests");
		var itemsDiv = this._pendingSection.appendItemList(this._pendingSection)
			.classed('hover-items deletable-items', true);
		this._noPendingResultsDiv = this._pendingSection.append('div')
			.text(crv.buttonTexts.none)
			.style("display", "none")
		this._pendingChunker = new GetDataChunker(itemsDiv.node(), 
			function(foundObjects, startVal) { return _this.getPendingRequestsDone(foundObjects, startVal); });
		this._pendingChunker.path = 'user[user grant request>grantee={0}]'.format(this.user.id());
		this._pendingChunker.fields = ["none"];
		this._pendingChunker.resultType = cr.User;
		
		this.appendActionButton("Ask To Follow", function()
			{
				if (prepareClick('click', 'request follow'))
				{
					showClickFeedback(this);
	
					var panel = new RequestFollowPanel(user, _this);
					
					panel
						.showUp()
						.then(function() {
								panel.emailInput.node().focus();
							})
						.always(unblockClick);
				}
				d3.event.preventDefault();
			});
			
		this._followingSection = new UserSectionView(this, user);
		this._followingSection.appendLabel("Following");
		this._followingSearchView = new FollowingSearchView(this._followingSection, user);
		
		$(this.node()).one('revealing.cr', function()
			{
				_this._pendingChunker.start("");			
				_this._followingSearchView.startSearchTimeout("");
			});	
	}
	
	return FollowingPanel;
})();

