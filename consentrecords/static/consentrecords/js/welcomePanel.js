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
		this.mainDiv.selectAll('li svg')
			.attr('width', width)
			.attr('height', this.scrollAreaHeight());
	}
	
	WelcomePanel.prototype.showPrevious = function()
	{
		var _this = this;
		var ol = this.mainDiv.selectAll('ol');
		var li = ol.selectAll('li');

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
								var isFirst = parseInt(d3.select(this).attr('index')) ==
									0;
								_this.mainDiv.selectAll('a.right')
									.style('display', null);
								_this.mainDiv.selectAll('a.left')
									.style('display', isFirst ? "none" : null);
								unblockClick();
							 });
			}
		}
	}

	
	WelcomePanel.prototype.showNext = function()
	{
		var _this = this;
		var ol = this.mainDiv.selectAll('ol');
		var li = ol.selectAll('li');
		
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
								var isLast = parseInt(d3.select(this).attr('index')) ==
									li.size() - 1;
								_this.mainDiv.selectAll('a.right')
									.style('display', isLast ? "none" : null);
								_this.mainDiv.selectAll('a.left')
									.style('display', null);
								unblockClick();
							 });
			}
		}
	}

	
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
		
		var d = panel2Div;
		
		var slides = 
			[
				{text: "PathAdvisor is a network to discover the best " + 
					   "opportunities for you and to help others by sharing your experiences.",
				 textLeft: "0px",
				 textTop: "1em",
				 path: "M0,300 C50,200 150,100 200,200 S300,200 400,200",
				 color0: PathView.prototype.guideData[0].color,
				},
				{text: "With PathAdvisor, you can answer three important questions:",
				 textLeft: "0px",
				 textTop: "2em",
				 path: "M0,200 C100,200 150,175 200,250 S300,250 400,250",
				 color0: PathView.prototype.guideData[2].color,
				},
				{text: "With what I've done, what opportunities should I take advantage of?",
				 textLeft: "0px",
				 textTop: "10%",
				 path: "M0,250 C100,250 160,100 200,200 S300,300 400,300",
				 color0: PathView.prototype.guideData[2].color,
				},
				{text: "What are people a few years older than me with similar goals to mine doing?",
				 textLeft: "0px",
				 textTop: "15%",
				 path: "M0,300 C100,300 160,100 200,250 S300,300 404,196",
				 color0: PathView.prototype.guideData[2].color,
				},
				{text: "How can I share my story with adults who can help guide me?",
				 textLeft: "0px",
				 textTop: "20%",
				 path: "M-4,204 C100,100 150,130 200,150 S300,130 400,125",
				 color0: PathView.prototype.guideData[2].color,
				},
				{text: "Seeing other pathways can give you ideas for what you want to do next.",
				 textLeft: "0px",
				 textTop: "1em",
				 path: "M0,125 C100,120 160,100 240,100 S250,300 415,190",
				 color0: PathView.prototype.guideData[3].color,
				},
				{text: "Your pathway and goals, whatever they have been, can also inspire others along their journeys.",
				 textLeft: "0px",
				 textTop: "2em",
				 path: "M-15,210 C150,100 160,100 200,230 S300,200 404,252",
				 color0: PathView.prototype.guideData[3].color,
				},
				{text: "Here are some examples of pathways:",
				 textLeft: "0px",
				 textTop: "1em",
				 path: "M-4,248 C100,300 160,100 200,230 S350,250 400,250",
				 color0: PathView.prototype.guideData[4].color,
				},
				{text: "A 22-year-old with the following experiences: College, Government Job",
				 textLeft: "0px",
				 textTop: "3em",
				 pathDescription: '"More Experiences"[Birthday>=1992][Birthday<=1994]["More Experience">Service[_name="College"]]::reference(_user)',
				 path: "M0,250 C100,250 140,150 180,225 S350,300 400,300",
				 color0: PathView.prototype.guideData[4].color,
				},
				{text: "A 53-year-old with the following experiences: Piano Lessons, Entrepreneur",
				 textLeft: "0px",
				 textTop: "4em",
				 pathDescription: '"More Experiences"[Birthday>=1962][Birthday<=1963]["More Experience">Service[_name="Piano Lessons"]]::reference(_user)',
				 path: "M0,300 C100,300 160,250 200,230 S320,200 400,200",
				 color0: PathView.prototype.guideData[4].color,
				},
				{text: "Ready to begin?",
				 textLeft: "0px",
				 textTop: "55%",
				 path: "M0,200 C80,200 200,100 240,150 S300,160 400,150",
				 color0: PathView.prototype.guideData[2].color,
				},
			];
		
// 				{text: "Organizations can use PathAdvisor to discover where the young people who " +
// 					   "participate in their programs have come from and what those young people " +
// 					   "do as they grow older.",
		
		var ol = d.append('ol');
			
	    <!-- Indicators -->
		var li = ol.selectAll('li')
			.data(slides)
			.enter()
			.append('li')
			.attr('index', function(fd, i) { return i; })
			.each(function(d, i) {
				var mc = new Hammer(this);
				
				if (i < slides.length - 1)
				{
					mc.on('panleft', function() { 
						_this.showNext(); 
					});
				}
				if (i > 0)
				{
					mc.on('panright', function() { 
						_this.showPrevious(); 
					});
				}
			});
			
		ol.selectAll('li:nth-child(1)')
			.classed('active', true);
			
		var svg = li.append('svg')
			.attr('viewBox', '0 0 400 400')
			.attr('preserveAspectRatio', 'none');
		var path = svg.append('path')
			.attr('d', function(d) { return d.path; })
			.attr('stroke', function(d) { return d.color0; });
		
		var p = li.append('p')
			.classed('body', true)
			.style('left', function(d) { return d.textLeft; })
			.style('top', function(d) { return d.textTop; })
			.text(function(d) { return d.text; });
		
		p.each(function(d)
			{
				if (d.pathDescription)
				{
					d3.select(this)
						.classed('site-active-text path-description-link', true)
						.on('click', function(d)
							{
								if (prepareClick('click', 'sample user'))
								{
									cr.getData({path: d.pathDescription,
										fields: ["typeName"],
										done: function(newInstances)
											{
												if (newInstances.length == 0)
													syncFailFunction("Sorry, this path is not available.");
												else
												{
													firstPanel = new PathlinesPanel(newInstances[0], _this.node(), true);
													firstPanel.pathtree.setUser(newInstances[0].getValue("More Experiences"), false);
													showPanelUp(firstPanel.node(), unblockClick);
												}
											},
										fail: syncFailFunction});
								}
							});
				}
			});	
			
		ol.selectAll('li:first-child')
			.append('span')
			.classed('about-organizations site-active-text', true)
			.text('For Organizations')
			.on('click', function()
				{
					if (prepareClick('click', 'For Organizations'))
					{
						var panel = new WelcomeOrganizationPanel(_this.node());
						showPanelUp(panel.node(), unblockClick);
					}
				});
		
		if (!cr.signedinUser.getValueID())
		{		
			ol.selectAll('li:last-child')
				.append('span')
				.classed('sign-in-prompt site-active-text', true)
				.text('Sign In')
				.on('click', function()
					{
						if (prepareClick('click', 'Sign In Prompt'))
						{
							showFixedPanel(_this.node(), "#id_sign_in_panel");
						}
					});
		}
	
		panel2Div
			.append('span')
			.classed('create-account-prompt site-active-text', true)
			.text('Create An Account')
			.on('click', function()
				{
					if (prepareClick('click', 'Create An Account'))
					{
						var signUp = new Signup(_this.node());
					}
				});

		var leftControl = d.append('a')
			.classed('left', true)
			.attr('role', 'button')
			.style('display', 'none')
			.on("click", function() { _this.showPrevious(); });
		
		appendLeftChevronSVG(leftControl)
			.classed('site-active-text', true);
			
		var rightControl = d.append('a')
			.classed('right', true)
			.attr('role', 'button')
			.on("click", function() { _this.showNext(); });
		
		appendRightChevronSVG(rightControl)
			.classed('site-active-text', true);	

		var signedIn = function(eventObject) {
			var pathwayPanel = new PathlinesPanel(cr.signedinUser, previousPanel, false);
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

