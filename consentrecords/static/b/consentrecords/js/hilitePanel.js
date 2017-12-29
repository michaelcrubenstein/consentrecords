var HilitePanel = (function () {
	HilitePanel.prototype = Object.create(EditPanel.prototype);
	HilitePanel.prototype.constructor = HilitePanel;

	HilitePanel.prototype.hide = function()
	{
		$(this.panel.node()).trigger('hiding.cr');
		this.panel.remove();
	}
	
	HilitePanel.prototype.fillCanvas = function()
	{
		var r = this.hilitedElement.getBoundingClientRect();
		var r2 = this.panelNode.getBoundingClientRect();
		var r0 = 10;
		var r1 = Math.max(r.width, r.height) / 2.0 * 1.5;
		var opacity = 0.5;
		var y0 = r.top - r2.top + r.height / 2.0;
		var x0 = r.left - r2.left + r.width / 2.0;

		this.panel.style('width', r2.width)
				  .style('height', r2.height);
				  
		
		this.canvas.attr('width', r2.width)
				   .attr('height', r2.height);

		var grd = this.context.createRadialGradient(x0,y0,r0,x0,y0,r1);
		grd.addColorStop(0, 'transparent');
		grd.addColorStop(1, 'rgba(0, 0, 0, {0})'.format(opacity));
		
		// Fill with gradient
		this.context.fillStyle = grd;
		this.context.fillRect(0,0,r2.width,r2.height);
	}
	
	HilitePanel.prototype.onCompleteClick = function()
	{
		this.hide();
		$(this.panelNode).off('resize.cr', this.fillCanvasFunction);
		unblockClick();
	}
	
	HilitePanel.prototype.onClose = function()
	{
		if (prepareClick('click', 'Close HilitePanel'))
		{
			this.onCompleteClick();
		}
	}
	
	function HilitePanel(panelNode, hilitedElement) {
			
		var _this = this;
		
		this.panelNode = panelNode;
		this.hilitedElement = hilitedElement;
		
		this.fillCanvasFunction = function() { _this.fillCanvas(); };

		this.panel = d3.select(panelNode).append('panel')
			.classed('hilite', true)
			.style('top', 0)
			.on('click', function()
				{
					_this.onClose();
				});
		
		this.canvas = this.panel
			.append('canvas');
		this.context = this.canvas.node().getContext('2d');
		
		setTimeout(function()
			{
				_this.fillCanvas();
			});
		$(this.panelNode).on('resize.cr', this.fillCanvasFunction);
	}
	
	return HilitePanel;
})();

var AddExperienceHilitePanel = (function()
{
	AddExperienceHilitePanel.prototype = Object.create(HilitePanel.prototype);
	AddExperienceHilitePanel.prototype.constructor = AddExperienceHilitePanel;
	
	AddExperienceHilitePanel.prototype.helpText = "Add Goals and Experiences to Your Path";
	AddExperienceHilitePanel.prototype.gotIt = "Continue";
	
	AddExperienceHilitePanel.prototype.hide = function()
	{
		HilitePanel.prototype.hide.call(this);
		$(this.helpSpanNode).remove();
		$(this.gotItNode).remove();
	}
	
	AddExperienceHilitePanel.prototype.onCompleteClick = function()
	{
		var _this = this;
		
		cr.signedinUser.update({'tip level': 1})
			.then(function()
				{
					HilitePanel.prototype.onCompleteClick.call(_this);
				},
				cr.syncFail);
	}
	
	AddExperienceHilitePanel.prototype.drawArrow = function()
	{
		var ctx = this.context;

		var r = {width: $(this.hilitedElement).innerWidth(), 
				 height: $(this.hilitedElement).innerHeight()};
		var r1 = Math.max(r.width, r.height) / 2.0 * 1.5;
		var $helpNode = $(this.helpSpanNode);
		var startPointX = parseFloat($helpNode.css('left')) + $helpNode.width() + 3;
		var startPointY = parseFloat($helpNode.css('top')) + $helpNode.innerHeight() / 2;
		var pos = $(this.hilitedElement).position();
		var endPointX = pos.left + r.width / 2 - r1;
		var endPointY = pos.top + r.height / 2 + 10;
		var quadPointX1 = (startPointX + endPointX) / 2 + 5;
		var quadPointY1 = startPointY;
		var quadPointX2 = (startPointX + endPointX) / 2 - 5;
		var quadPointY2 = endPointY;
		var anglePointX = (quadPointX1 / 6) + (quadPointX2 / 6 * 5);
		var anglePointY = (quadPointY1 / 6) + (quadPointY2 / 6 * 5);

		ctx.strokeStyle = "rgb(255,255,255)";
		ctx.lineWidth = 2.3;

		var arrowAngle = Math.atan2(anglePointX - endPointX, anglePointY - endPointY) + Math.PI;
		var arrowWidth = 12;

		ctx.beginPath();
		ctx.moveTo(startPointX, startPointY);

		ctx.bezierCurveTo(quadPointX1, quadPointY1, quadPointX2, quadPointY2, endPointX, endPointY);

		ctx.moveTo(endPointX - (arrowWidth * Math.sin(arrowAngle - Math.PI / 6)), 
				   endPointY - (arrowWidth * Math.cos(arrowAngle - Math.PI / 6)));

		ctx.lineTo(endPointX, endPointY);

		ctx.lineTo(endPointX - (arrowWidth * Math.sin(arrowAngle + Math.PI / 6)), 
				   endPointY - (arrowWidth * Math.cos(arrowAngle + Math.PI / 6)));

		ctx.stroke();
		ctx.closePath();
	}
	
	AddExperienceHilitePanel.prototype.fillCanvas = function()
	{
		HilitePanel.prototype.fillCanvas.call(this);
		
		var r = this.hilitedElement.getBoundingClientRect();
		var r2 = this.panelNode.getBoundingClientRect();
		var r3 = this.helpSpanNode.getBoundingClientRect();
		
		/* x0, y0 is the lower left corner of the hilitedElement */
		var r1 = Math.max(r.width, r.height) / 2.0 * 1.5;
		var y0 = r.top - r2.top + r.height / 2.0 + r1;
		var x0 = r.left - r2.left + r.width / 2.0 - r1;
		
		x0 -= 3 * this.emToPx;
		var left = Math.max(x0 - this.helpMaxWidth, this.emToPx);

		$(this.helpSpanNode).css('top', y0)
			.css('left', left)
			.css('width', x0 - left);
		this.drawArrow();
		
		left = Math.max(x0 - this.gotItWidth, this.emToPx);
		$(this.gotItNode).css('top', y0 + $(this.helpSpanNode).outerHeight() + this.emToPx)
			.css('left', left)
			.css('width', x0 - left);
	}
	
	function AddExperienceHilitePanel()
	{
		HilitePanel.apply(this, arguments);
		
		var _this = this;
		this.helpSpanNode = d3.select(this.panelNode).append('span')
			.classed('hilite-help', true)
			.text(this.helpText)
			.node();
		this.gotItNode = d3.select(this.panelNode).append('span')
			.classed('hilite-got-it', true)
			.text(this.gotIt)
			.on('click', function()
				{
					_this.onClose();
				})
			.node();
		this.emToPx = parseFloat($(this.helpSpanNode).css('font-size'));
		this.helpMaxWidth = $(this.helpSpanNode).outerWidth();
		this.gotItWidth = $(this.gotItNode).outerWidth();
	}
	
	return AddExperienceHilitePanel;
})();
