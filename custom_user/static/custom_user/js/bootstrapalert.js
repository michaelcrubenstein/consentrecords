$(document).ready(function(){
	<!-- Block of code for an alert area at the top of the window -->
	bootstrap_alert = function() {}
	bootstrap_alert.show = function(parentDiv, message, alertClass) {
		parentDiv.html('<div class="alert ' + alertClass + '"><button type="button" class="close" aria-hidden="true">&times;</button><span>'+message+'</span></div>');
		$(".close").click(function(){
			closealert();
		});
		$(window).trigger("resize");
	}
	bootstrap_alert.warning = function(message, divID) {
		divID = (typeof divID !== 'undefined' ? divID : '#myAlert');

		bootstrap_alert.show($(divID), message, "alert-danger");
	}
	bootstrap_alert.success = function(message, divID) {
		divID = (typeof divID !== 'undefined' ? divID : '#myAlert');

		bootstrap_alert.show($(divID), message, "alert-success");
	}
	closealert = function() {
		if ($('.alert').parent().children().length)
		{
			$('.alert').parent().html('');
			$(window).trigger("resize");
		}
	}
});
