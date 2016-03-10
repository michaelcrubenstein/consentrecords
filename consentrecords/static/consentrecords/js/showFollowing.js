var RequestFollowSearchView = (function () {
	RequestFollowSearchView.prototype = new PanelSearchView();
	
	/* Overrides SearchView.prototype.onClickButton */
	RequestFollowSearchView.prototype.onClickButton = function(d, i) {
	}

	RequestFollowSearchView.prototype.showObjects = function(foundObjects)
	{
		var buttons = SearchView.prototype.showObjects.call(this, foundObjects);
		
		var _this = this;
		buttons.on("click", function(d, i)
			{
				if (prepareClick('click', 'request to follow user', false))
				{
					var _thisButton = this;
					var done = function()
					{
						bootstrap_alert.success("Access to {0} has been requested.".format(d.getDescription()),
																		  ".alert-container");
						$(_thisButton.parentNode).animate({height: "0px"}, 400, 'swing', function()
						{
							$(this).remove();
							unblockClick();
						});
					}
					cr.addObjectValue("#"+d.getValueID(), "_access request", _this.user, done, syncFailFunction);
				}
				d3.event.preventDefault();
			});
			
		return buttons;
	}
	
	
	/* Overrides SearchView.searchPath */
	RequestFollowSearchView.prototype.searchPath = function(val)
	{
		var s = '_user::not(#{0})::not(#{0}::reference("_access record")[_privilege=_read,_write,_administer]::reference(_user))'.format(this.user.getValueID());
		s += '::not(_user["_access request"={0}])'.format(this.user.getValueID());
		if (val.length == 0)
			return s;
		else if (val.length < 3)
			return s + '[_email^="' + val + '"]';
		else
			return s + '[_email*="' + val + '"]';
	}
	
	/* Overrides SearchView.prototype.isButtonVisible */
	RequestFollowSearchView.prototype.isButtonVisible = function(button, d)
	{
		return d.getDescription().toLocaleLowerCase().indexOf(this._constrainCompareText) >= 0;
	}
	
	function RequestFollowSearchView(sitePanel, user)
	{
		this.user = user;
		PanelSearchView.call(this, sitePanel, "Email", undefined, SelectAllChunker);
	}
	
	return RequestFollowSearchView;
})();
	
var RequestFollowPanel = (function() {
	RequestFollowPanel.prototype = new SitePanel();
	RequestFollowPanel.prototype.offeringID = null;
	
	function RequestFollowPanel(user, previousPanel) {
		var header = "Ask to Follow";
		SitePanel.call(this, previousPanel, null, header, "list", revealPanelUp);
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent)
		    .append("span").text("Done");
		
		var _this = this;	

		navContainer.appendTitle(header);

		this.searchView = new RequestFollowSearchView(this, user);

		showPanelUp(this.node());
	}
	
	return RequestFollowPanel;
})();

var FollowingSearchView = (function () {
	FollowingSearchView.prototype = new PanelSearchView();
	
	/* Overrides SearchView.prototype.onClickButton */
	FollowingSearchView.prototype.onClickButton = function(d, i) {
		if (prepareClick('click', 'show user'))
		{
			showUser(d, this.sitePanel.node());
		}
		d3.event.preventDefault();
	}
	
	/* Overrides SearchView.searchPath */
	FollowingSearchView.prototype.searchPath = function(val)
	{
		var s1 = "#" + this.user.instanceID + '::reference("_access record")[_privilege=_read,_write,_administer]::reference(_user)';
		var s2 = '_user["_access request"={0}]'.format(this.user.getValueID());
		if (val.length == 0)
			return '{0}|{1}'.format(s1, s2);
		else if (val.length < 3)
			return '{0}[_email^="{2}"]|{1}[_email^="{2}"]'.format(s1, s2, val);
		else
			return '{0}[_email*="{2}"]|{1}[_email*="{2}"]'.format(s1, s2, val);
	}
	
	/* Overrides SearchView.prototype.isButtonVisible */
	FollowingSearchView.prototype.isButtonVisible = function(button, d)
	{
		return d.getDescription().toLocaleLowerCase().indexOf(this._constrainCompareText) >= 0;
	}
	
	FollowingSearchView.prototype.noResultString = function()
	{
		if (this._constrainCompareText && this._constrainCompareText.length > 0)
			return "No Results";
		else
			return "You are not following anyone. Click '+' to ask to follow someone."
	}
	
	FollowingSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	function FollowingSearchView(sitePanel, user)
	{
		this.user = user;
		PanelSearchView.call(this, sitePanel, "Email", undefined, SelectAllChunker);
	}
	
	return FollowingSearchView;
})();
	
var FollowingPanel = (function() {
	FollowingPanel.prototype = new SitePanel();
	FollowingPanel.prototype.offeringID = null;
	
	function FollowingPanel(user, previousPanel) {
		var header = "Following";
		SitePanel.call(this, previousPanel, null, header, "list");
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent)
		    .append("span").text("Done");
		
		var _this = this;	
		var addExperienceButton = navContainer.appendRightButton()
			.classed('add-button', true)
			.on("click", function(d) {
				if (prepareClick('click', 'request follow'))
				{
					showClickFeedback(this);
	
					var newPanel = new RequestFollowPanel(user, _this.node());
				}
				d3.event.preventDefault();
			});
		addExperienceButton.append("span").text("+");

		navContainer.appendTitle(header);

		this.searchView = new FollowingSearchView(this, user);
		this.searchView.search("");

		showPanelLeft(this.node());
	}
	
	return FollowingPanel;
})();

