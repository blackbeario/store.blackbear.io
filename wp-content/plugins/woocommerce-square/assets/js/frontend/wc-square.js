/* global wc_cart_fragments_params */

/**
 * WooCommerce Square Payment Form handler.
 *
 * @since 2.0.0
 */
jQuery( document ).ready( ( $ ) => {
	/**
	 * Square Credit Card Payment Form Handler class.
	 *
	 * @since 2.0.0
	 */
	class WC_Square_Payment_Form_Handler {
		/**
		 * Setup handler.
		 *
		 * @since 2.3.2-1
		 *
		 * @param {Object} args
		 */
		constructor( args ) {
			this.id = args.id;
			this.id_dasherized = args.id_dasherized;
			this.csc_required = args.csc_required;
			this.enabled_card_types = args.enabled_card_types;
			this.square_card_types = args.square_card_types;
			this.ajax_log_nonce = args.ajax_log_nonce;
			this.ajax_url = args.ajax_url;
			this.application_id = args.application_id;
			this.currency_code = args.currency_code;
			this.general_error = args.general_error;
			this.input_styles = args.input_styles;
			this.is_3ds_enabled = args.is_3d_secure_enabled;
			this.is_add_payment_method_page = args.is_add_payment_method_page;
			this.is_checkout_registration_enabled = args.is_checkout_registration_enabled;
			this.is_user_logged_in = args.is_user_logged_in;
			this.location_id = args.location_id;
			this.logging_enabled = args.logging_enabled;
			this.ajax_wc_checkout_validate_nonce = args.ajax_wc_checkout_validate_nonce;
			this.is_manual_order_payment = args.is_manual_order_payment;

			if ( $( 'form.checkout' ).length ) {
				this.form = $( 'form.checkout' );
				this.handle_checkout_page();
			} else if ( $( 'form#order_review' ).length ) {
				this.form = $( 'form#order_review' );
				this.handle_pay_page();
			} else if ( $( 'form#add_payment_method' ).length ) {
				this.form = $( 'form#add_payment_method' );
				this.handle_add_payment_method_page();
			} else {
				this.log( 'No payment form found!' );
				return;
			}

			// localized error messages.
			this.params = window.sv_wc_payment_gateway_payment_form_params;

			// unblock the UI and clear any payment nonces when a server-side error occurs.
			$( document.body ).on( 'checkout_error', () => {
				$( 'input[name=wc-square-credit-card-payment-nonce]' ).val( '' );
				$( 'input[name=wc-square-credit-card-buyer-verification-token]' ).val( '' );
			} );

			$( document.body ).on( 'click', `#payment_method_${ this.id }`, () => {
				if ( this.payment_form ) {
					this.log( 'Recalculating payment form size' );
					this.payment_form.recalculateSize();
				}
			} );
		}

		/**
		 * Public: Handle required actions on the checkout page.
		 */
		handle_checkout_page() {
			// updated payment fields jQuery object on each checkout update (prevents stale data).
			$( document.body ).on( 'updated_checkout', () => this.set_payment_fields() );

			// handle saved payment methods note on the checkout page.
			// this is bound to `updated_checkout` so it fires even when other parts of the checkout are changed.
			$( document.body ).on( 'updated_checkout', () => this.handle_saved_payment_methods() );

			// validate payment data before order is submitted.
			this.form.on( `checkout_place_order_${ this.id }`, () => this.validate_payment_data() );
		}

		/**
		 * Public: Handle associated actions for saved payment methods.
		 */
		handle_saved_payment_methods() {
			// make available inside change events.
			const id_dasherized = this.id_dasherized;
			const form_handler = this;
			const $new_payment_method_selection = $( `div.js-wc-${ id_dasherized }-new-payment-method-form` );

			// show/hide the saved payment methods when a saved payment method is de-selected/selected.
			$( `input.js-wc-${ this.id_dasherized }-payment-token` ).on( 'change', () => {
				const tokenized_payment_method_selected = $( `input.js-wc-${ id_dasherized }-payment-token:checked` ).val();

				if ( tokenized_payment_method_selected ) {
					// using an existing tokenized payment method, hide the 'new method' fields.
					$new_payment_method_selection.slideUp( 200 );
				} else {
					// use new payment method, display the 'new method' fields.
					$new_payment_method_selection.slideDown( 200 );
				}
			} ).trigger( 'change' );

			// display the 'save payment method' option for guest checkouts if the 'create account' option is checked
			// but only hide the input if there is a 'create account' checkbox (some themes just display the password).
			$( 'input#createaccount' ).on( 'change', ( e ) => {
				if ( $( e.target ).is( ':checked' ) ) {
					form_handler.show_save_payment_checkbox( id_dasherized );
				} else {
					form_handler.hide_save_payment_checkbox( id_dasherized );
				}
			} );

			if ( ! $( 'input#createaccount' ).is( ':checked' ) ) {
				$( 'input#createaccount' ).trigger( 'change' );
			}

			// hide the 'save payment method' when account creation is not enabled and customer is not logged in.
			if ( ! this.is_user_logged_in && ! this.is_checkout_registration_enabled ) {
				this.hide_save_payment_checkbox( id_dasherized );
			}
		}

		/**
		 * Public: Handle required actions on the Order > Pay page.
		 */
		handle_pay_page() {
			this.set_payment_fields();

			// handle saved payment methods.
			this.handle_saved_payment_methods();

			const self = this;

			// validate payment data before order is submitted.
			// but only when one of our payment gateways is selected.
			this.form.on( 'submit', function() {
				if ( $( '#order_review input[name=payment_method]:checked' ).val() === self.id ) {
					return self.validate_payment_data();
				}
			} );
		}

		/**
		 * Public: Handle required actions on the Add Payment Method page.
		 */
		handle_add_payment_method_page() {
			this.set_payment_fields();

			const self = this;

			// validate payment data before order is submitted.
			// but only when one of our payment gateways is selected.
			this.form.on( 'submit', function() {
				if ( $( '#add_payment_method input[name=payment_method]:checked' ).val() === self.id ) {
					return self.validate_payment_data();
				}
			} );
		}

		/**
		 * Sets up the Square payment fields.
		 *
		 * @since 2.0.0
		 */
		set_payment_fields() {
			if ( ! $( `#wc-${ this.id_dasherized }-account-number-hosted` ).length ) {
				return;
			}

			if ( $( `#wc-${ this.id_dasherized }-account-number-hosted` ).is( 'iframe' ) ) {
				this.log( 'Re-adding payment form' );

				for ( const [ _, field ] of Object.entries( this.form_fields ) ) { // eslint-disable-line no-unused-vars
					$( field.attr( 'id' ) ).replaceWith( field );
				}

				this.handle_form_loaded();
			} else {
				if ( this.payment_form ) {
					this.log( 'Destroying payment form' );
					this.payment_form.destroy();
					this.payment_form = null;
				}

				this.log( 'Building payment form' );

				this.payment_form = new SqPaymentForm( this.get_form_params() ); // eslint-disable-line no-undef

				this.payment_form.build();
			}
		}

		/**
		 * Gets the Square payment form params.
		 *
		 * @since 2.0.0
		 *
		 * @return {Object} Form params.
		 */
		get_form_params() {
			this.form_fields = {
				card_number: $( `#wc-${ this.id_dasherized }-account-number-hosted` ),
				expiration: $( `#wc-${ this.id_dasherized }-expiry-hosted` ),
				csc: $( `#wc-${ this.id_dasherized }-csc-hosted` ),
				postal_code: $( `#wc-${ this.id_dasherized }-postal-code-hosted` ),
			};

			return {
				applicationId: this.application_id,
				locationId: this.location_id,
				cardNumber: {
					elementId: this.form_fields.card_number.attr( 'id' ),
					placeholder: this.form_fields.card_number.data( 'placeholder' ),
				},
				expirationDate: {
					elementId: this.form_fields.expiration.attr( 'id' ),
					placeholder: this.form_fields.expiration.data( 'placeholder' ),
				},
				cvv: {
					elementId: this.form_fields.csc.attr( 'id' ),
					placeholder: this.form_fields.csc.data( 'placeholder' ),
				},
				postalCode: {
					elementId: this.form_fields.postal_code.attr( 'id' ),
					placeholder: this.form_fields.postal_code.data( 'placeholder' ),
				},
				inputClass: `wc-${ this.id_dasherized }-payment-field`,
				inputStyles: this.input_styles,
				callbacks: {
					inputEventReceived: ( e ) => this.handle_input_event( e ),
					cardNonceResponseReceived: ( errors, nonce, cardData ) => this.handle_card_nonce_response( errors, nonce, cardData ),
					unsupportedBrowserDetected: () => this.handle_unsupported_browser(),
					paymentFormLoaded: () => this.handle_form_loaded(),
				},
			};
		}

		/**
		 * Handles when the payment form is fully loaded.
		 *
		 * @since 2.0.0
		 */
		handle_form_loaded() {
			this.log( 'Payment form loaded' );

			this.payment_form.setPostalCode( $( '#billing_postcode' ).val() );

			// hide the postcode field on the checkout page or if it already has a value.
			if ( $( 'form.checkout' ).length || $( '#billing_postcode' ).val() ) {
				$( '.wc-square-credit-card-card-postal-code-parent' ).addClass( 'hidden' );
			}
		}

		/**
		 * Handles payment form input changes.
		 *
		 * @since 2.0.0
		 *
		 * @param {Object} e
		 */
		handle_input_event( e ) {
			const $input = $( '#' + e.elementId );

			if ( e.eventType === 'cardBrandChanged' ) {
				this.handle_card_brand_change( e.cardBrand, $input );
			}
		}

		/**
		 * Handles card number brand changes.
		 *
		 * @since 2.0.0
		 *
		 * @param {string} brand
		 * @param {Object} $input
		 */
		handle_card_brand_change( brand, $input ) {
			this.log( `Card brand changed to ${ brand }` );

			// clear any existing card type class
			$input.attr( 'class', ( i, c ) => {
				return c.replace( /(^|\s)card-type-\S+/g, '' );
			} );

			let card_class = 'plain';

			if ( null === brand || 'unknown' === brand ) {
				brand = '';
			}

			if ( null !== this.square_card_types[ brand ] ) {
				brand = this.square_card_types[ brand ];
			}

			if ( brand && ! this.enabled_card_types.includes( brand ) ) {
				card_class = 'invalid';
			} else {
				card_class = brand;
			}

			$( `input[name=wc-${ this.id_dasherized }-card-type]` ).val( brand );

			$input.addClass( `card-type-${ card_class }` );
		}

		/**
		 * Used to request a card nonce and submit the form.
		 *
		 * @since 2.0.0
		 */
		validate_payment_data() {
			if ( this.form.is( '.processing' ) ) {
				// bail when already processing.
				return false;
			}

			// let through if nonce is already present - nonce is only present on non-tokenized payments.
			if ( this.has_nonce() ) {
				this.log( 'Payment nonce present, placing order' );
				return true;
			}

			const tokenized_card_id = this.get_tokenized_payment_method_id();

			if ( tokenized_card_id ) {
				if ( ! this.is_3ds_enabled ) {
					// if 3DS is disabled and paying with a saved method, no further validation needed.
					return true;
				}

				if ( this.has_verification_token() ) {
					this.log( 'Tokenized payment verification token present, placing order' );
					return true;
				}

				this.log( 'Requesting verification token for tokenized payment' );

				this.block_ui();
				this.payment_form.verifyBuyer( tokenized_card_id, this.get_verification_details(), this.handle_verify_buyer_response.bind( this ) );
				return false;
			}

			this.log( 'Requesting payment nonce' );
			this.block_ui();
			this.payment_form.requestCardNonce();
			return false;
		}

		/**
		 * Gets the selected tokenized payment method ID, if there is one.
		 *
		 * @since 2.1.0
		 *
		 * @return {string} Tokenized payment method ID.
		 */
		get_tokenized_payment_method_id() {
			return $( `.payment_method_${ this.id }` ).find( '.js-wc-square-credit-card-payment-token:checked' ).val();
		}

		/**
		 * Handles the Square payment form card nonce response.
		 *
		 * @since 2.1.0
		 *
		 * @param {Object} errors Validation errors, if any.
		 * @param {string} nonce Payment nonce.
		 * @param {Object} cardData Non-confidential info about the card used.
		 */
		handle_card_nonce_response( errors, nonce, cardData ) {
			// if we have real errors to display from Square.
			if ( errors ) {
				return this.handle_errors( errors );
			}

			// no errors, but also no payment data.
			if ( ! nonce ) {
				const message = 'Nonce is missing from the Square response';

				this.log( message, 'error' );
				this.log_data( message, 'response' );
				return this.handle_errors();
			}

			// if we made it this far, we have payment data.
			this.log( 'Card data received' );
			this.log( cardData );
			this.log_data( cardData, 'response' );

			if ( cardData.last_4 ) {
				$( `input[name=wc-${ this.id_dasherized }-last-four]` ).val( cardData.last_4 );
			}

			if ( cardData.exp_month ) {
				$( `input[name=wc-${ this.id_dasherized }-exp-month]` ).val( cardData.exp_month );
			}

			if ( cardData.exp_year ) {
				$( `input[name=wc-${ this.id_dasherized }-exp-year]` ).val( cardData.exp_year );
			}

			if ( cardData.billing_postal_code ) {
				$( `input[name=wc-${ this.id_dasherized }-payment-postcode]` ).val( cardData.billing_postal_code );
			}

			// payment nonce data.
			$( `input[name=wc-${ this.id_dasherized }-payment-nonce]` ).val( nonce );

			// if 3ds is enabled, we need to verify the buyer and record the verification token before continuing.
			if ( this.is_3ds_enabled ) {
				this.log( 'Verifying buyer' );

				this.payment_form.verifyBuyer( nonce, this.get_verification_details(), this.handle_verify_buyer_response.bind( this ) );

				return;
			}

			// now that we have a nonce, resubmit the form.
			this.form.trigger( 'submit' );
		}

		/**
		 * Handles the response from a call to verifyBuyer()
		 *
		 * @since 2.1.0
		 *
		 * @param {Object} errors Verification errors, if any.
		 * @param {Object} verification_result Results of verification.
		 */
		handle_verify_buyer_response( errors, verification_result ) {
			if ( errors ) {
				$( errors ).each( ( index, error ) => {
					if ( ! error.field ) {
						error.field = 'none';
					}
				} );

				return this.handle_errors( errors );
			}

			// no errors, but also no verification token.
			if ( ! verification_result || ! verification_result.token ) {
				const message = 'Verification token is missing from the Square response';

				this.log( message, 'error' );
				this.log_data( message, 'response' );

				return this.handle_errors();
			}

			this.log( 'Verification result received' );
			this.log( verification_result );

			$( `input[name=wc-${ this.id_dasherized }-buyer-verification-token]` ).val( verification_result.token );

			this.form.trigger( 'submit' );
		}

		/**
		 * Gets a verification details object to be used in verifyBuyer()
		 *
		 * @since 2.1.0
		 *
		 * @return {Object} Verification details object.
		 */
		get_verification_details() {
			const verification_details = {
				billingContact: {
					familyName: $( '#billing_last_name' ).val() || '',
					givenName: $( '#billing_first_name' ).val() || '',
					email: $( '#billing_email' ).val() || '',
					country: $( '#billing_country' ).val() || '',
					region: $( '#billing_state' ).val() || '',
					city: $( '#billing_city' ).val() || '',
					postalCode: $( '#billing_postcode' ).val() || '',
					phone: $( '#billing_phone' ).val() || '',
					addressLines: [ $( '#billing_address_1' ).val() || '', $( '#billing_address_2' ).val() || '' ],
				},
				intent: this.get_intent(),
			};

			if ( 'CHARGE' === verification_details.intent ) {
				verification_details.amount = this.get_amount();
				verification_details.currencyCode = this.currency_code;
			}

			this.log( verification_details );

			return verification_details;
		}

		/**
		 * Gets the intent of this processing - either 'CHARGE' or 'STORE'
		 *
		 * The gateway stores cards before processing a payment, so this checks whether the customer checked "save method"
		 * at checkout, and isn't otherwise using a saved method already.
		 *
		 * @since 2.1.0
		 *
		 * @return {string} {'CHARGE'|'STORE'}
		 */
		get_intent() {
			const $save_method_input = $( '#wc-square-credit-card-tokenize-payment-method' );

			let save_payment_method;

			if ( $save_method_input.is( 'input:checkbox' ) ) {
				save_payment_method = $save_method_input.is( ':checked' );
			} else {
				save_payment_method = 'true' === $save_method_input.val();
			}

			if ( ! this.get_tokenized_payment_method_id() && save_payment_method ) {
				return 'STORE';
			}

			return 'CHARGE';
		}

		/**
		 * Gets the amount of this payment.
		 *
		 * @since 2.1.0
		 *
		 * @return {string} Payment amount.
		 */
		get_amount() {
			return $( `input[name=wc-${ this.id_dasherized }-amount]` ).val();
		}

		/**
		 * Handles unsupported browsers.
		 *
		 * @since 2.0.0
		 */
		handle_unsupported_browser() {}

		/**
		 * Handle error data.
		 *
		 * @since 2.0.0
		 *
		 * @param {Object|null} errors
		 */
		handle_errors( errors = null ) {
			this.log( 'Error getting payment data', 'error' );

			// clear any previous nonces
			$( 'input[name=wc-square-credit-card-payment-nonce]' ).val( '' );
			$( 'input[name=wc-square-credit-card-buyer-verification-token]' ).val( '' );

			const messages = [];

			if ( errors ) {
				const field_order = [ 'none', 'cardNumber', 'expirationDate', 'cvv', 'postalCode' ];

				if ( errors.length >= 1 ) {
					// sort based on the field order without the brackets around a.field and b.field.
					// the precedence is different and gives different results.
					errors.sort( ( a, b ) => {
						return field_order.indexOf( a.field ) - field_order.indexOf( b.field );
					} );
				}

				$( errors ).each( ( index, error ) => {
					// only display the errors that can be helped by the customer.
					if ( 'UNSUPPORTED_CARD_BRAND' === error.type || 'VALIDATION_ERROR' === error.type ) {
						// To avoid confusion between CSC used in the frontend and CVV that is used in the error message.
						return messages.push( error.message.replace( /CVV/, 'CSC' ) );
					}

					// otherwise, log more serious errors to the debug log.
					return this.log_data( errors, 'response' );
				} );
			}

			// if no specific messages are set, display a general error.
			if ( messages.length === 0 ) {
				messages.push( this.general_error );
			}

			// Conditionally process error rendering.
			if ( ! this.is_add_payment_method_page && ! this.is_manual_order_payment ) {
				this.render_checkout_errors( messages );
			} else {
				this.render_errors( messages );
			}

			this.unblock_ui();
		}

		/**
		 * Public: Render any new errors and bring them into the viewport.
		 *
		 * @param {Array} errors
		 */
		render_errors( errors ) {
			// hide and remove any previous errors.
			$( '.woocommerce-error, .woocommerce-message' ).remove();

			// add errors.
			this.form.prepend( '<ul class="woocommerce-error"><li>' + errors.join( '</li><li>' ) + '</li></ul>' );

			// unblock UI
			this.form.removeClass( 'processing' ).unblock();
			this.form.find( '.input-text, select' ).trigger( 'blur' );

			// scroll to top
			$( 'html, body' ).animate( {
				scrollTop: this.form.offset().top - 100,
			}, 1000 );
		}

		/**
		 * Blocks the payment form UI.
		 *
		 * @since 3.0.0
		 */
		block_ui() {
			this.form.block( {
				message: null,
				overlayCSS: {
					background: '#fff',
					opacity: 0.6,
				},
			} );
		}

		/**
		 * Unblocks the payment form UI.
		 *
		 * @since 3.0.0
		 */
		unblock_ui() {
			return this.form.unblock();
		}

		/**
		 * Hides save payment method checkbox.
		 *
		 * @since 2.1.2
		 *
		 * @param {string} id_dasherized
		 */
		hide_save_payment_checkbox( id_dasherized ) {
			const $parent_row = $( `input.js-wc-${ id_dasherized }-tokenize-payment-method` ).closest( 'p.form-row' );

			$parent_row.hide();
			$parent_row.next().hide();
		}

		/**
		 * Shows save payment method checkbox.
		 *
		 * @since 2.1.2
		 *
		 * @param {string} id_dasherized
		 */
		show_save_payment_checkbox( id_dasherized ) {
			const $parent_row = $( `input.js-wc-${ id_dasherized }-tokenize-payment-method` ).closest( 'p.form-row' );

			$parent_row.slideDown();
			$parent_row.next().show();
		}

		/**
		 * Determines if a nonce is present in the hidden input.
		 *
		 * @since 2.0.0
		 *
		 * @return {boolean} True if nonce is present, otherwise false.
		 */
		has_nonce() {
			return $( `input[name=wc-${ this.id_dasherized }-payment-nonce]` ).val();
		}

		/**
		 * Determines if a verification token is present in the hidden input.
		 *
		 * @since 2.1.0
		 *
		 * @return {boolean} True if verification token is present, otherwise false.
		 */
		has_verification_token() {
			return $( `input[name=wc-${ this.id_dasherized }-buyer-verification-token]` ).val();
		}

		/**
		 * Logs data to the debug log via AJAX.
		 *
		 * @since 2.0.0
		 *
		 * @param {Object} data Request data.
		 * @param {string} type Data type.
		 */
		log_data( data, type ) {
			// if logging is disabled, bail.
			if ( ! this.logging_enabled ) {
				return;
			}

			const ajax_data = {
				action: 'wc_' + this.id + '_log_js_data',
				security: this.ajax_log_nonce,
				type,
				data,
			};

			$.ajax( {
				url: this.ajax_url,
				data: ajax_data,
			} );
		}

		/**
		 * Logs any messages or errors to the console.
		 *
		 * @since 2.0.0
		 *
		 * @param {string} message
		 * @param {string} type Data type.
		 */
		log( message, type = 'notice' ) {
			// if logging is disabled, bail.
			if ( ! this.logging_enabled ) {
				return;
			}

			if ( 'error' === type ) {
				console.error( 'Square Error: ' + message );
			} else {
				console.log( 'Square: ' + message );
			}
		}

		/**
		 * AJAX validate WooCommerce form data.
		 *
		 * Triggered only if errors are present on Square payment form.
		 *
		 * @since 2.2
		 *
		 * @param {Array} square_errors Square validation errors.
		 */
		render_checkout_errors( square_errors ) {
			const ajax_url = wc_cart_fragments_params.wc_ajax_url.toString().replace( '%%endpoint%%', this.id + '_checkout_handler' );
			const square_handler = this;

			const form_data = this.form.serializeArray();

			// Add action field to data for nonce verification.
			form_data.push( {
				name: 'wc_' + this.id + '_checkout_validate_nonce',
				value: this.ajax_wc_checkout_validate_nonce,
			} );

			return $.ajax( {
				url: ajax_url,
				method: 'post',
				cache: false,
				data: form_data,
				complete: ( response ) => {
					const result = response.responseJSON;

					// If validation is not triggered and WooCommerce returns failure.
					// Temporary workaround to fix problems when user email is invalid.
					if ( result.hasOwnProperty( 'result' ) && 'failure' === result.result ) {
						$( result.messages ).map( ( message ) => {
							const errors = [];

							$( message ).children( 'li' ).each( () => {
								errors.push( $( this ).text().trim() );
							} );

							return square_errors.unshift( ...errors );
						} );

					// If validation is complete and WooCommerce returns validaiton errors.
					} else if ( result.hasOwnProperty( 'success' ) && ! result.success ) {
						square_errors.unshift( ...result.data.messages );
					}

					square_handler.render_errors( square_errors );
				},
			} );
		}
	}

	window.WC_Square_Payment_Form_Handler = WC_Square_Payment_Form_Handler;
} );
