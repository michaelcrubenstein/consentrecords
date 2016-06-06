var WelcomePanel = (function () {
	WelcomePanel.prototype = new SitePanel();
	
	WelcomePanel.prototype.handleResize = function()
	{
		var ol = this.mainDiv.selectAll('ol');
		var li = ol.selectAll('li');
		var activeIndex = parseInt(ol.selectAll('li.active').attr('index'));
		var width = this.scrollAreaWidth();
		li.style('left', function(fd, i)
			{
				return "{0}px".format(i < activeIndex ? -width :
					   				  i == activeIndex ? 0 : width);
			});
		this.mainDiv.selectAll('svg')
			.attr('width', width)
			.attr('height', this.scrollAreaHeight());
	}
	
	function WelcomePanel(previousPanel, onPathwayCreated) {
		var _this = this;
		SitePanel.call(this, previousPanel, null, "Welcome", "welcome background-gradient-panel");
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
		
		var d = panel2Div;
		
		var slides = 
			[
				{text: "PathAdvisor is a platform to help young people discover " + 
					   "opportunities that fuel their passions and realize their dreams.",
				 textLeft: "0px",
				 textTop: "0px",
				 path: "M0,300 C50,200 150,100 200,200 S300,200 400,200",
				},
				{text: "With PathAdvisor, young people can answer three important questions:",
				 textLeft: "0px",
				 textTop: "5%",
				 path: "M0,200 C100,200 150,175 200,250 S300,250 400,250",
				},
				{text: "With what I've done, what opportunities should I take advantage of?",
				 textLeft: "0px",
				 textTop: "10%",
				 path: "M0,250 C100,250 160,100 200,200 S300,300 400,300",
				},
				{text: "What are people a few years older than me with similar goals to mine doing?",
				 textLeft: "0px",
				 textTop: "15%",
				 path: "M0,300 C100,300 160,100 200,250 S300,300 404,196",
				},
				{text: "How can I share my story with adults who can help guide me?",
				 textLeft: "0px",
				 textTop: "20%",
				 path: "M-4,204 C100,100 150,130 200,150 S300,130 400,125",
				},
				{text: "Every person has a pathway through life.",
				 textLeft: "0px",
				 textTop: "0px",
				 path: "M0,125 C100,120 160,100 200,140 S300,150 400,150",
				},
				{text: "Your pathway is unique, but other pathways can give you ideas for what you want to do next.",
				 textLeft: "0px",
				 textTop: "0px",
				 path: "M0,150 C100,150 160,100 240,100 S250,300 415,190",
				},
				{text: "Your pathway and goals, whatever they have been, can also inspire others along their journey.",
				 textLeft: "0px",
				 textTop: "5%",
				 path: "M-15,210 C150,100 160,100 200,230 S300,200 404,252",
				},
				{text: "Here are some examples of pathways:",
				 textLeft: "0px",
				 textTop: "0px",
				 path: "M-4,248 C100,300 160,100 200,230 S350,250 400,250",
				},
				{text: "A 22-year-old with the following experiences: College, Government Job",
				 textLeft: "0px",
				 textTop: "20%",
				 pathID: '{{path1}}',
				 path: "M0,250 C100,250 140,150 180,225 S350,300 400,300",
				},
				{text: "A 53-year-old with the following experiences: Piano Lessons, Entrepreneur",
				 textLeft: "0px",
				 textTop: "30%",
				 pathID: '{{path2}}',
				 path: "M0,300 C100,300 160,250 200,230 S320,200 400,200",
				},
				{text: "Organizations can use PathAdvisor to discover where the young people who " +
					   "participate in their programs have come from and what those young people " +
					   "do as they grow older.",
				 textLeft: "0px",
				 textTop: "55%",
				 path: "M0,200 C80,200 200,100 240,150 S300,160 400,150",
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
		;
	
		li.append('p')
			.text(function(d) { return d.text; })
			.style('left', function(d) { return d.textLeft; })
			.style('top', function(d) { return d.textTop; });
			
		var svg = li.append('svg')
			.attr('viewBox', '0 0 400 400')
			.attr('preserveAspectRatio', 'none');
		var path = svg.append('path')
			.attr('d', function(d) { return d.path; });
		
			
		var leftControl = d.append('a')
			.classed('left', true)
			.attr('role', 'button')
			.on("click", function()
				{
					var activeIndex = parseInt(ol.selectAll('li.active').attr('index'));
					if (activeIndex > 0)
					{
						if (prepareClick('click', 'next welcome panel {0}'.format(activeIndex)))
						{
							$(ol.selectAll('li.active').node())
								.animate({left: "{0}px".format(_this.scrollAreaWidth())},
										 700,
										 function()
										 {
											d3.select(this).classed('active', false);
										 });

							/* nth-child is 1-based, activeIndex is 0-based. Thus, this 
								activates the previous item. */
							$(ol.selectAll('li:nth-child({0})'.format(activeIndex)).node())
								.animate({left: "{0}px".format(0)},
										 700,
										 function()
										 {
											d3.select(this).classed('active', true);
											unblockClick();
										 });
						}
					}
				});
			
		leftControl.append('span')
			.classed('glyphicon glyphicon-chevron-left', true)
			.attr('aria-hidden', 'true');
		leftControl.append('span')
			.classed('sr-only', true)
			.text('Previous');
			
		var rightControl = d.append('a')
			.classed('right', true)
			.attr('role', 'button')
			.on("click", function()
				{
					var activeIndex = parseInt(ol.selectAll('li.active').attr('index'));
					if (activeIndex < ol.selectAll('li').size() - 1)
					{
						if (prepareClick('click', 'next welcome panel {0}'.format(activeIndex)))
						{
							$(ol.selectAll('li.active').node())
								.animate({left: "{0}px".format(-_this.scrollAreaWidth())},
										 700,
										 function()
										 {
											d3.select(this).classed('active', false);
										 });
							/* nth-child is 1-based, activeIndex is 0-based. Thus, this 
								activates the next item. */
							$(ol.selectAll('li:nth-child({0})'.format(activeIndex + 2)).node())
								.animate({left: "{0}px".format(0)},
										 700,
										 function()
										 {
											d3.select(this).classed('active', true);
											unblockClick();
										 });
						}
					}
				});
			
		rightControl.append('span')
			.classed('glyphicon glyphicon-chevron-right', true)
			.attr('aria-hidden', 'true');
		rightControl.append('span')
			.classed('sr-only', true)
			.text('Next');

		var signedIn = function(eventObject) {
			var pathwayPanel = new PathtreePanel(cr.signedinUser, previousPanel, false);
			pathwayPanel.pathtree.setUser(cr.signedinUser.getValue("More Experiences"), true);
			showPanelLeft(pathwayPanel.node(),
				function()
				{
					if (onPathwayCreated)
						onPathwayCreated(pathwayPanel);
					$(_this.node()).remove();
				});
			
		};
		
		$(this.mainDiv.node()).on("resize.cr", function()
			{
				_this.handleResize();
			});
		
		$(cr.signedinUser).on("signin.cr", null, this.node(), signedIn);
		$(this.node()).on("remove", null, function()
			{
				$(cr.signedinUser).off("signin.cr", null, signedIn);
			});
	}
	
	return WelcomePanel;
})();

