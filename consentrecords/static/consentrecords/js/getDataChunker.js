
/* Used to chunk getData operations. */
var GetDataChunker = (function() {
	GetDataChunker.prototype.path = null;
	GetDataChunker.prototype.fields = [];
	GetDataChunker.prototype.increment = 50;
	GetDataChunker.prototype._containerNode = null;
	GetDataChunker.prototype._loadingMessage = null;
	GetDataChunker.prototype._start = 0;
	GetDataChunker.prototype._inGetData = false;
	GetDataChunker.prototype._onGetDataDone = null;
	
	GetDataChunker.prototype.clearLoadingMessage = function()
	{
		if (this._loadingMessage != null)
		{
			crv.stopLoadingMessage(this._loadingMessage);
			this._loadingMessage.remove();
			this._loadingMessage = null;
		}
		this._inGetData = false;
	}
	
	GetDataChunker.prototype.restart = function(instances)
	{
		if (this._loadingMessage != null)
		{
			if (instances.length < this.increment)
			{
				this.clearLoadingMessage();
				this._start = 0;
			}
			else
			{
				this._start += this.increment;
				var panelHeight = $(this._containerNode).height();
				var position = $(this._loadingMessage.node()).position();
				if (position.top < panelHeight)
					this.start();
				else
					this._inGetData = false;
			}
		}
	}
	
	GetDataChunker.prototype.doneGetData = function(instances)
	{
		if (this._loadingMessage != null)
			crv.stopLoadingMessage(this._loadingMessage);
		this._onGetDataDone(instances);
		this.restart(instances);
	}
	
	GetDataChunker.prototype.start = function()
	{
		var _this = this;
		
		if (this._loadingMessage == null)
			this._loadingMessage = crv.appendLoadingMessage(this._containerNode);
		else
			crv.startLoadingMessage(this._loadingMessage);

		cr.getData({path: this.path, 
					start: this._start,
					end: this._start + this.increment,
					fields: this.fields, 
					done: function(instances) { _this.doneGetData(instances); }, 
					fail: asyncFailFunction});
		this._inGetData = true;
	}
	
	GetDataChunker.prototype.onScroll = function()
	{
		if (this._loadingMessage != null && !this._inGetData)
		{
			var panelHeight = $(this._containerNode).height();
			var position = $(this._loadingMessage.node()).position();
			if (position.top < panelHeight)
				this.start();
		}
	}

	function GetDataChunker(containerNode, onGetDataDone)
	{
		this._containerNode = containerNode;
		this._loadingMessage = null;
		this.path = null;
		this._start = 0;
		this._inGetData = false;
		this._onGetDataDone = onGetDataDone;
		
		var _this = this;
		function checkFunction()
		{
			_this.onScroll();
		}
		
		$(containerNode).scroll(checkFunction);
		$(window).resize(checkFunction);
		$(containerNode).on("remove", function()
			{
				$(window).off("resize", checkFunction);
			});
	}
	
	return GetDataChunker;
})();
