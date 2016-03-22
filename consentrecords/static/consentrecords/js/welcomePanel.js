var WelcomePanel = (function () {
	WelcomePanel.prototype = new SitePanel();
	
	function WelcomePanel(previousPanel) {
		var _this = this;
		SitePanel.call(this, previousPanel, null, "Welcome", "welcome");
		var navContainer = this.appendNavContainer();

		var signinSpan = navContainer.appendRightButton()
			.on("click", function()
				{
					showClickFeedback(this);
					if (prepareClick('click',  'Sign In button'))
					{
						showFixedPanel(_this.node(), "#id_sign_in_panel");
					}
					d3.event.preventDefault();
				})
			.append('span').text('Sign In');
			
		navContainer.appendTitle("PathAdvisor");
		
		var panel2Div = this.appendScrollArea();

		var signedIn = function(eventObject) {
			var pathwayPanel = new PathwayPanel(cr.signedinUser, previousPanel, false);
			pathwayPanel.pathway.setUser(cr.signedinUser, true);
			showPanelLeft(pathwayPanel.node(),
				function()
				{
					$(_this.node()).remove();
				});
			
		};
		
		$(cr.signedinUser).on("signin.cr", null, _this.node(), signedIn);
		$(_this.node()).on("remove", null, function()
			{
				$(cr.signedinUser).off("signin.cr", null, signedIn);
			});
	}
	
	return WelcomePanel;
})();

