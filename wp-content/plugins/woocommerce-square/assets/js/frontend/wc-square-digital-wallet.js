/* global wc_add_to_cart_variation_params, SqPaymentForm */

/**
 * Square Credit Card Digital Wallet Handler class.
 *
 * @since 2.3
 */
jQuery( document ).ready( ( $ ) => {
	/**
	 * Square Credit Card Digital Wallet Handler class.
	 *
	 * @since 2.3
	 */
	class WC_Square_Digital_Wallet_Handler {
		/**
		 * Setup handler
		 *
		 * @param {Array} args
		 * @since 2.3
		 */
		constructor( args ) {
			this.args = args;
			this.payment_request = args.payment_request;
			this.total_amount = args.payment_request.total.amount;
			this.wallet = '#wc-square-digital-wallet';
			this.buttons = '.wc-square-wallet-buttons';

			if ( $( this.wallet ).length === 0 ) {
				return;
			}

			$( this.wallet ).hide();
			$( this.buttons ).hide();

			this.build_digital_wallet();
			this.attach_page_events();
		}

		/**
		 * Fetch a new payment request object and reload the SqPaymentForm
		 *
		 * @since 2.3
		 */
		build_digital_wallet() {
			this.block_ui();
			this.get_payment_request().then(
				( response ) => {
					this.payment_request = JSON.parse( response );
					this.total_amount = this.payment_request.total.amount;
					this.load_square_form();
					this.unblock_ui();
				},
				( message ) => {
					this.log( '[Square] Could not build payment request. ' + message, 'error' );
					$( this.wallet ).hide();
				}
			);
		}

		/**
		 * Add page event listeners
		 *
		 * @since 2.3
		 */
		attach_page_events() {
			if ( this.args.context === 'product' ) {
				const addToCartButton = $( '.single_add_to_cart_button' );

				$( '#wc-square-apple-pay, #wc-square-google-pay' ).on( 'click', ( e ) => {
					if ( addToCartButton.is( '.disabled' ) ) {
						e.stopImmediatePropagation();

						if ( addToCartButton.is( '.wc-variation-is-unavailable' ) ) {
							window.alert( wc_add_to_cart_variation_params.i18n_unavailable_text );
						} else if ( addToCartButton.is( '.wc-variation-selection-needed' ) ) {
							window.alert( wc_add_to_cart_variation_params.i18n_make_a_selection_text );
						}
						return;
					}

					this.add_to_cart();
				} );

				$( document.body ).on( 'woocommerce_variation_has_changed', () => this.build_digital_wallet() );

				$( '.quantity' ).on( 'input', '.qty', () => this.build_digital_wallet() );
			}

			if ( this.args.context === 'cart' ) {
				$( document.body ).on( 'updated_cart_totals', () => this.build_digital_wallet() );
			}

			if ( this.args.context === 'checkout' ) {
				$( document.body ).on( 'updated_checkout', () => this.build_digital_wallet() );
			}
		}

		/**
		 * Load the digital wallet payment form
		 *
		 * @since 2.3
		 */
		load_square_form() {
			if ( this.payment_form ) {
				this.log( '[Square] Destroying digital wallet payment form' );
				this.payment_form.destroy();
			}

			this.log( '[Square] Building digital wallet payment form' );
			this.payment_form = new SqPaymentForm( this.get_form_params() );
			this.payment_form.build();
		}

		/**
		 * Gets the Square payment form params.
		 *
		 * @since 2.3
		 */
		get_form_params() {
			const params = {
				applicationId: this.args.application_id,
				locationId: this.args.location_id,
				autobuild: false,
				applePay: {
					elementId: 'wc-square-apple-pay',
				},
				googlePay: {
					elementId: 'wc-square-google-pay',
				},
				callbacks: {
					paymentFormLoaded: () => this.unblock_ui(),
					createPaymentRequest: () => this.create_payment_request(),
					methodsSupported: ( methods, unsupportedReason ) => this.methods_supported( methods, unsupportedReason ),
					shippingContactChanged: ( shippingContact, done ) => this.handle_shipping_address_changed( shippingContact, done ),
					shippingOptionChanged: ( shippingOption, done ) => this.handle_shipping_option_changed( shippingOption, done ),
					cardNonceResponseReceived: ( errors, nonce, cardData, billingContact, shippingContact, shippingOption ) => {
						this.handle_card_nonce_response( errors, nonce, cardData, billingContact, shippingContact, shippingOption );
					},
				},
			};

			// Fix console errors for Google Pay when there are no shipping options set. See note in Square documentation under shippingOptions: https://developer.squareup.com/docs/api/paymentform#paymentrequestfields.
			if ( this.payment_request.requestShippingAddress === false ) {
				delete params.callbacks.shippingOptionChanged;
			}

			// Remove support for Google Pay and/or Apple Pay if chosen in settings.
			if ( this.args.hide_button_options.includes( 'google' ) ) {
				delete params.googlePay;
			}

			if ( this.args.hide_button_options.includes( 'apple' ) ) {
				delete params.applePay;
			}

			return params;
		}

		/**
		 * Sets the a payment request object for the Square Payment Form
		 *
		 * @since 2.3
		 */
		create_payment_request() {
			return this.payment_request;
		}

		/**
		 * Check which methods are supported and show/hide the correct buttons on frontend
		 * Reference: https://developer.squareup.com/docs/api/paymentform#methodssupported
		 *
		 * @param {Object} methods
		 * @param {string} unsupportedReason
		 *
		 * @since 2.3
		 */
		methods_supported( methods, unsupportedReason ) {
			if ( methods.applePay === true || methods.googlePay === true ) {
				if ( methods.applePay === true ) {
					$( '#wc-square-apple-pay' ).show();
				}

				if ( methods.googlePay === true ) {
					$( '#wc-square-google-pay' ).show();
				}

				$( this.wallet ).show();
			} else {
				this.log( unsupportedReason );
			}
		}

		/*
		 * Get the payment request on a product page
		 *
		 * @since 2.3
		 */
		get_payment_request() {
			return new Promise( ( resolve, reject ) => {
				const data = {
					context: this.args.context,
					security: this.args.payment_request_nonce,
				};

				if ( this.args.context === 'product' ) {
					const product_data = this.get_product_data();
					$.extend( data, product_data );
				}
				// retrieve a payment request object.
				$.post( this.get_ajax_url( 'get_payment_request' ), data, ( response ) => {
					if ( response.success ) {
						return resolve( response.data );
					}

					return reject( response.data );
				} );
			} );
		}

		/*
		 * Handle all shipping address recalculations in the Apple/Google Pay window
		 *
		 * Reference: https://developer.squareup.com/docs/api/paymentform#shippingcontactchanged
		 *
		 * @since 2.3
		 */
		handle_shipping_address_changed( shippingContact, done ) {
			const data = {
				context: this.args.context,
				shipping_contact: shippingContact.data,
				security: this.args.recalculate_totals_nonce,
			};

			// send ajax request get_shipping_options.
			this.recalculate_totals( data ).then( ( response ) => {
				return done( response );
			}, () => {
				return done( {
					error: 'Bad Request',
				} );
			} );
		}

		/*
		 * Handle all shipping method changes in the Apple/Google Pay window
		 *
		 * Reference: https://developer.squareup.com/docs/api/paymentform#shippingoptionchanged
		 *
		 * @since 2.3
		 */
		handle_shipping_option_changed( shippingOption, done ) {
			const data = {
				context: this.args.context,
				shipping_option: shippingOption.data.id,
				security: this.args.recalculate_totals_nonce,
			};

			this.recalculate_totals( data ).then( ( response ) => {
				return done( response );
			}, () => {
				return done( {
					error: 'Bad Request',
				} );
			} );
		}

		/*
		 * Handle the payment response.
		 *
		 * On success, set the checkout billing/shipping data and submit the checkout.
		 *
		 * @since 2.3
		 */
		handle_card_nonce_response( errors, nonce, cardData, billingContact, shippingContact, shippingOption ) {
			if ( errors ) {
				return this.render_errors( errors );
			}

			if ( ! nonce ) {
				return this.render_errors( this.args.general_error );
			}

			this.block_ui();

			const data = {
				action: '',
				_wpnonce: this.args.process_checkout_nonce,
				billing_first_name: billingContact.givenName ? billingContact.givenName : '',
				billing_last_name: billingContact.familyName ? billingContact.familyName : '',
				billing_company: '',
				billing_email: shippingContact.email ? shippingContact.email : '',
				billing_phone: shippingContact.phone ? shippingContact.phone : '',
				billing_country: billingContact.country ? billingContact.country.toUpperCase() : '',
				billing_address_1: billingContact.addressLines && billingContact.addressLines[ 0 ] ? billingContact.addressLines[ 0 ] : '',
				billing_address_2: billingContact.addressLines && billingContact.addressLines[ 1 ] ? billingContact.addressLines[ 1 ] : '',
				billing_city: billingContact.city ? billingContact.city : '',
				billing_state: billingContact.region ? billingContact.region : '',
				billing_postcode: billingContact.postalCode ? billingContact.postalCode : '',
				shipping_first_name: shippingContact.givenName ? shippingContact.givenName : '',
				shipping_last_name: shippingContact.familyName ? shippingContact.familyName : '',
				shipping_company: '',
				shipping_country: shippingContact.country ? shippingContact.country.toUpperCase() : '',
				shipping_address_1: shippingContact.addressLines && shippingContact.addressLines[ 0 ] ? shippingContact.addressLines[ 0 ] : '',
				shipping_address_2: shippingContact.addressLines && shippingContact.addressLines[ 1 ] ? shippingContact.addressLines[ 1 ] : '',
				shipping_city: shippingContact.city ? shippingContact.city : '',
				shipping_state: shippingContact.region ? shippingContact.region : '',
				shipping_postcode: shippingContact.postalCode ? shippingContact.postalCode : '',
				shipping_method: [ ! shippingOption ? null : shippingOption.id ],
				order_comments: '',
				payment_method: 'square_credit_card',
				ship_to_different_address: 1,
				terms: 1,
				'wc-square-credit-card-payment-nonce': nonce,
				'wc-square-credit-card-last-four': cardData.last_4 ? cardData.last_4 : null,
				'wc-square-credit-card-exp-month': cardData.exp_month ? cardData.exp_month : null,
				'wc-square-credit-card-exp-year': cardData.exp_year ? cardData.exp_year : null,
				'wc-square-credit-card-payment-postcode': cardData.billing_postal_code ? cardData.billing_postal_code : null,
				'wc-square-digital-wallet-type': cardData.digital_wallet_type,
			};

			// handle slightly different mapping for Google Pay (Google returns full name as a single string).
			if ( cardData.digital_wallet_type === 'GOOGLE_PAY' ) {
				if ( billingContact.givenName ) {
					data.billing_first_name = billingContact.givenName.split( ' ' ).slice( 0, 1 ).join( ' ' );
					data.billing_last_name = billingContact.givenName.split( ' ' ).slice( 1 ).join( ' ' );
				}

				if ( shippingContact.givenName ) {
					data.shipping_last_name = shippingContact.givenName.split( ' ' ).slice( 0, 1 ).join( ' ' );
					data.shipping_last_name = shippingContact.givenName.split( ' ' ).slice( 1 ).join( ' ' );
				}
			}

			// if the billing_phone was not found on shippingContact, use the value on billingContact if that exists.
			if ( ! data.billing_phone && billingContact.phone ) {
				data.billing_phone = billingContact.phone;
			}

			// if SCA is enabled, verify the buyer and add verification token to data.
			if ( this.args.is_3d_secure_enabled ) {
				this.log( '3DS verification enabled. Verifying buyer' );

				var self = this;

				this.payment_form.verifyBuyer(
					nonce,
					self.get_verification_details( billingContact, shippingContact ),
					function(err, verificationResult) {
						if (err == null) {
							// SCA verification complete. Do checkout.
							self.log( '3DS verification successful' );
							data['wc-square-credit-card-buyer-verification-token'] = verificationResult.token;
							self.do_checkout( data );
						} else {
							// SCA verification failed. Render errors.
							self.log( '3DS verification failed' );
							self.log(err);
							self.render_errors( [err.message] );
						}
					}
				);
			} else {
				// SCA not enabled. Do checkout.
				this.do_checkout( data );
			}
		}

		/**
		 * Do Digital Wallet Checkout
		 *
		 * @since 2.4.2
		 *
		 * @param {Object} args
		 */
		do_checkout( data ) {
			// AJAX process checkout.
			this.process_digital_wallet_checkout( data ).then(
				( response ) => {
					window.location = response.redirect;
				},
				( response ) => {
					this.log( response, 'error' );
					this.render_errors_html( response.messages );
				}
			);
		}

		/**
		 * Gets a verification details object to be used in verifyBuyer()
		 *
		 * @since 2.4.2
		 *
		 * @param {Object} billingContact
		 * @param {Object} shippingContact
		 *
		 * @return {Object} Verification details object.
		 */
		get_verification_details( billingContact, shippingContact ) {
			const verification_details = {
				intent: 'CHARGE',
				amount: this.total_amount,
				currencyCode: this.payment_request.currencyCode,
				billingContact: {
					familyName: billingContact.familyName ? billingContact.familyName : '',
					givenName: billingContact.givenName ? billingContact.givenName : '',
					email: shippingContact.email ? shippingContact.email : '',
					country: billingContact.country ? billingContact.country.toUpperCase() : '',
					region: billingContact.region ? billingContact.region : '',
					city: billingContact.city ? billingContact.city : '',
					postalCode: billingContact.postalCode ? billingContact.postalCode : '',
					phone: shippingContact.phone ? shippingContact.phone : '',
					addressLines: billingContact.addressLines ? billingContact.addressLines : '',
				},
			}

			this.log( verification_details );

			return verification_details;
		}

		/*
		 * Recalculate totals
		 *
		 * @since 2.3
		 */
		recalculate_totals( data ) {
			return new Promise( ( resolve, reject ) => {
				return $.post( this.get_ajax_url( 'recalculate_totals' ), data, ( response ) => {
					if ( response.success ) {
						this.total_amount = response.data.total.amount;
						return resolve( response.data );
					}
					return reject( response.data );
				} );
			} );
		}

		/*
		 * Get the product data for building the payment request on the product page
		 *
		 * @since 2.3
		 */
		get_product_data() {
			let product_id = $( '.single_add_to_cart_button' ).val();

			const attributes = {};

			// Check if product is a variable product.
			if ( $( '.single_variation_wrap' ).length ) {
				product_id = $( '.single_variation_wrap' ).find( 'input[name="product_id"]' ).val();
				if ( $( '.variations_form' ).length ) {
					$( '.variations_form' ).find( '.variations select' ).each( ( index, select ) => {
						const attribute_name = $( select ).data( 'attribute_name' ) || $( select ).attr( 'name' );
						const value = $( select ).val() || '';
						return attributes[ attribute_name ] = value;
					} );
				}
			}

			return {
				product_id,
				quantity: $( '.quantity .qty' ).val(),
				attributes,
			};
		}

		/*
		 * Add the product to the cart
		 *
		 * @since 2.3
		 */
		add_to_cart() {
			const data = {
				security: this.args.add_to_cart_nonce,
			};
			const product_data = this.get_product_data();
			$.extend( data, product_data );

			// retrieve a payment request object.
			$.post( this.get_ajax_url( 'add_to_cart' ), data, ( response ) => {
				if ( response.error ) {
					return window.alert( response.data );
				}

				const data = JSON.parse( response.data );
				this.payment_request = data.payment_request;
				this.args.payment_request_nonce = data.payment_request_nonce;
				this.args.add_to_cart_nonce = data.add_to_cart_nonce;
				this.args.recalculate_totals_nonce = data.recalculate_totals_nonce;
				this.args.process_checkout_nonce = data.process_checkout_nonce;
			} );
		}

		/*
		 * Process the digital wallet checkout
		 *
		 * @since 2.3
		 */
		process_digital_wallet_checkout( data ) {
			return new Promise( ( resolve, reject ) => {
				$.post( this.get_ajax_url( 'process_checkout' ), data, ( response ) => {
					if ( response.result === 'success' ) {
						return resolve( response );
					}

					return reject( response );
				} );
			} );
		}

		/*
		 * Helper function to return the ajax URL for the given request/action
		 *
		 * @since 2.3
		 */
		get_ajax_url( request ) {
			return this.args.ajax_url.replace( '%%endpoint%%', 'square_digital_wallet_' + request );
		}

		/*
		 * Renders errors given the error message HTML
		 *
		 * @since 2.3
		 */
		render_errors_html( errors_html ) {
			// hide and remove any previous errors.
			$( '.woocommerce-error, .woocommerce-message' ).remove();

			const element = this.args.context === 'product' ? $( '.product' ) : $( '.shop_table.cart' ).closest( 'form' );

			// add errors
			element.before( errors_html );

			// unblock UI
			this.unblock_ui();

			// scroll to top
			$( 'html, body' ).animate( {
				scrollTop: element.offset().top - 100,
			}, 1000 );
		}

		/*
		 * Renders errors
		 *
		 * @since 2.3
		 */
		render_errors( errors ) {
			const error_message_html = '<ul class="woocommerce-error"><li>' + errors.join( '</li><li>' ) + '</li></ul>';
			this.render_errors_html( error_message_html );
		}

		/*
		 * Block the Apple Pay and Google Pay buttons from being clicked which processing certain actions
		 *
		 * @since 2.3
		 */
		block_ui() {
			$( this.buttons ).block( {
				message: null,
				overlayCSS: {
					background: '#fff',
					opacity: 0.6,
				},
			} );
		}

		/*
		 * Unblock the wallet buttons
		 *
		 * @since 2.3
		 */
		unblock_ui() {
			$( this.buttons ).unblock();
		}

		/*
		 * Logs messages to the console when logging is turned on in the settings
		 *
		 * @since 2.3
		 */
		log( message, type = 'notice' ) {
			// if logging is disabled, bail.
			if ( ! this.args.logging_enabled ) {
				return;
			}

			if ( type === 'error' ) {
				return console.error( message );
			}

			return console.log( message );
		}
	}

	window.WC_Square_Digital_Wallet_Handler = WC_Square_Digital_Wallet_Handler;
} );
