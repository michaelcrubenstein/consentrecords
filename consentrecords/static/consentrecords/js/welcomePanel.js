var WelcomePanel = (function () {
	WelcomePanel.prototype = new SitePanel();
	
	function WelcomePanel(previousPanel, onPathwayCreated) {
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
		
		var d = panel2Div.append('div');
		
		panel2Div.append('p')
			.text('Share your pathway and goals with your friends');
			
		panel2Div.append('p')
			.text('Discover how your experiences can unlock new opportunities');
			
		panel2Div.append('p')
			.text('Introduce yourself to mentors who can help you');
			
		panel2Div.append('p')
			.text('Follow others who have taken paths similar to yours');
			
		panel2Div.append('p')
			.text('Find opportunities that can help you reach your goals');

		panel2Div.append('p')
			.text('All from a safe place where you are in charge');

		var signedIn = function(eventObject) {
			var pathwayPanel = new PathtreePanel(cr.signedinUser, previousPanel, false);
			pathwayPanel.pathtree.setUser(cr.signedinUser, true);
			showPanelLeft(pathwayPanel.node(),
				function()
				{
					if (onPathwayCreated)
						onPathwayCreated(pathwayPanel);
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

