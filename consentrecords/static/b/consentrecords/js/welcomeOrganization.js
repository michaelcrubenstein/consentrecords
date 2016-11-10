var WelcomeOrganizationPanel = (function () {
	WelcomeOrganizationPanel.prototype = new SitePanel();
	
	WelcomeOrganizationPanel.prototype.handleResize = function()
	{
	}
	
	function WelcomeOrganizationPanel(previousPanel, onPathwayCreated) {
		var _this = this;
		this.createRoot(null, "Welcome", "welcome-info");
		var navContainer = this.appendNavContainer();
		
		var doneButton = navContainer.appendLeftButton()
			.on("click", function()
				{
					_this.handleCloseDownEvent();
				})
			.append('span').text('Done');

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
		
		var d = panel2Div;
		
		var slides = 
			[
				{text: "Organizations that provide services of any kind to young people can use PathAdvisor " +
					   "to discover where the young people who " +
					   "participate in their programs have come from and what those young people " +
					   "do as they grow older.",
				},
				{text: "With PathAdvisor, organizations can answer two important questions:",
				},
				{text: "What experiences have the young people who are coming to our program already had?",
				 cssClass: "indent1",
				},
				{text: "What experiences have the young people who have been through our program gone to?",
				 cssClass: "indent1",
				},
				{text: "The following hierarchy is used to describe organizations and their offerings:",
				},
				{text: "Organization - the organization itself, its name, website, etc.",
				 cssClass: "indent1",
				},
				{text: "Site - the locations where the organization provides its offerings",
				 cssClass: "indent2",
				},
				{text: "Offering - the offerings that are provided by the organization",
				 cssClass: "indent3",
				},
				{text: "Session - the occurences of each offering",
				 cssClass: "indent4",
				},
				{text: "Inquiry - a record of a user who expressed interest in a session",
				 cssClass: "indent5",
				},
				{text: "Enrollment - a record of a user who was enrolled in a session.",
				 cssClass: "indent5",
				},
				{text: "Participation - a record of a user who participated in a session.",
				 cssClass: "indent5",
				},
			];
		
		var ol = d.append('ol');
			
	    <!-- Indicators -->
		var li = ol.selectAll('li')
			.data(slides)
			.enter()
			.append('li')
			.attr('index', function(fd, i) { return i; });
			
		ol.selectAll('li:nth-child(1)')
			.classed('active', true);
			
		var p = li.append('p')
			.classed('body', true)
			.text(function(d) { return d.text; })
			.each(function(d) {
					if (d.cssClass)
						d3.select(this).classed(d.cssClass, true);
				});
	}
	
	return WelcomeOrganizationPanel;
})();

