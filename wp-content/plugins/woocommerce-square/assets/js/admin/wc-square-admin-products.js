/* global wc_square_admin_products */

/**
 * WooCommerce Square admin general scripts for the settings page and update tab.
 *
 * @since 2.0.0
 */
jQuery( document ).ready( ( $ ) => {
	const typenow = window.typenow || '';
	const pagenow = window.pagenow || '';

	// bail if not on product admin pages.
	if ( 'product' !== typenow ) {
		return;
	}

	// bail if product sync is disabled.
	if ( ! wc_square_admin_products.is_product_sync_enabled ) {
		return;
	}

	// products quick edit screen.
	if ( 'edit-product' === pagenow ) {
		// when clicking the quick edit button fetch the default Synced with Square checkbox
		$( '#the-list' ).on( 'click', '.editinline', ( e ) => {
			const $row = $( e.target ).closest( 'tr' );
			const postID = $row.find( 'th.check-column input' ).val();
			const data = {
				action: 'wc_square_get_quick_edit_product_details',
				security: wc_square_admin_products.get_quick_edit_product_details_nonce,
				product_id: $row.find( 'th.check-column input' ).val(),
			};

			$.post( wc_square_admin_products.ajax_url, data, ( response ) => {
				const $editRow = $( 'tr#edit-' + postID );
				const $squareSynced = $editRow.find( 'select.square-synced' );
				const $errors = $editRow.find( '.wc-square-sync-with-square-errors' );

				if ( ! response.success && response.data ) {
					// if the product has multiple attributes we show an inline error message and bail.
					if ( 'multiple_attributes' === response.data ) {
						$squareSynced.prop( 'checked', false );
						$squareSynced.prop( 'disabled', true );
						$errors.find( '.multiple_attributes' ).show();
						return;

						// if the product has variations without an SKU we show an inline error message and bail.
					} else if ( 'missing_variation_sku' === response.data ) {
						$squareSynced.prop( 'checked', false );
						$squareSynced.prop( 'disabled', true );
						$errors.find( '.missing_variation_sku' ).show();
						return;
					}
				}

				const $sku = $editRow.find( 'input[name=_sku]' );
				const $stockStatus = $editRow.find( 'select[name=_stock_status]' );
				const $stockQty = $editRow.find( 'input[name=_stock]' );
				const $manageStockLabel = $editRow.find( '.manage_stock_field .manage_stock' );
				const $manageStockInput = $editRow.find( 'input[name=_manage_stock]' );
				const $manageStockDesc = '<span class="description"><a href="' + wc_square_admin_products.settings_url + '">' + wc_square_admin_products.i18n.synced_with_square + '</a></span>';
				const edit_url = response.data.edit_url;
				const i18n = response.data.i18n;
				const is_variable = response.data.is_variable;

				$squareSynced.val( response.data.is_synced_with_square );

				// if the SKU changes, enabled or disable Synced with Square checkbox accordingly
				$sku.on( 'change keyup keypress', ( e ) => {
					if ( '' === $( e.target ).val() && ! is_variable ) {
						$squareSynced.val( 'no' ).trigger( 'change' );
						$squareSynced.prop( 'disabled', true );
						$errors.find( '.missing_sku' ).show();
					} else {
						$squareSynced.prop( 'disabled', false );
						$squareSynced.trigger( 'change' );
						return $errors.find( '.missing_sku' ).hide();
					}
				} ).trigger( 'change' );

				// if Synced with Square is enabled, we might as well disable stock management (without verbose explanations as in the product page).
				$squareSynced.on( 'change', ( e ) => {
					if ( 'no' === $( e.target ).val() ) {
						$manageStockInput.off();
						$manageStockInput.add( $stockQty ).css( {
							opacity: 1,
						} );

						$manageStockLabel.find( '.description' ).remove();

						// Stock input manipulation will differ depending on whether product is variable or simple.
						if ( is_variable ) {
							if ( $manageStockInput.is( ':checked' ) ) {
								$( '.stock_qty_field' ).show();
								$( '.backorder_field' ).show();
							} else {
								$( '.stock_status_field' ).show();
							}
						} else {
							$stockQty.prop( 'readonly', false );
							$stockStatus.prop( 'readonly', false );
						}
					} else {
						$manageStockInput.prop( 'checked', true );
						$manageStockInput.on( 'click', () => {
							return false;
						} );

						$manageStockInput.add( $stockQty ).css( {
							opacity: '0.5',
						} );

						$manageStockLabel.append( $manageStockDesc );

						if ( wc_square_admin_products.is_woocommerce_sor && edit_url && i18n ) {
							$manageStockLabel.append( '<p class="description"><a href="' + edit_url + '">' + i18n + '</a></p>' );
						}

						if ( is_variable ) {
							$( '.stock_status_field' ).hide();
							$( '.stock_qty_field' ).hide();
							$( '.backorder_field' ).hide();
						} else {
							$stockQty.prop( 'readonly', true );
							$stockStatus.prop( 'readonly', true );
						}
					}
				} ).trigger( 'change' );
			} );
		} );
	}

	// individual product edit screen.
	if ( 'product' === pagenow ) {
		const syncCheckboxID = '#_' + wc_square_admin_products.synced_with_square_taxonomy;

		/**
		 * Checks whether the product is variable.
		 *
		 * @since 2.0.0
		 */
		const isVariable = () => {
			return wc_square_admin_products.variable_product_types.includes( $( '#product-type' ).val() );
		};

		/**
		 * Checks whether the product has a SKU.
		 *
		 * @since 2.0.0
		 */
		const hasSKU = () => {
			return '' !== $( '#_sku' ).val().trim();
		};

		/**
		 * Checks whether the product variations all have SKUs.
		 *
		 * @since 2.2.3
		 *
		 * @param {Array} skus
		 */
		const hasVariableSKUs = ( skus ) => {
			if ( ! skus.length ) {
				return false;
			}

			const valid = skus.filter( ( sku ) => '' !== $( sku ).val().trim() );

			return valid.length === skus.length;
		};

		/**
		 * Checks whether the given skus are unique.
		 *
		 * @since 2.2.3
		 *
		 * @param {Array} skus
		 */
		const hasUniqueSKUs = ( skus ) => {
			const skuValues = skus.map( ( sku ) => $( sku ).val() );

			return skuValues.every( ( sku ) => skuValues.indexOf( sku ) === skuValues.lastIndexOf( sku ) );
		};

		/**
		 * Checks whether the product has more than one variation attribute.
		 *
		 * @since 2.0.0
		 */
		const hasMultipleAttributes = () => {
			const $variation_attributes = $( '.woocommerce_attribute_data input[name^="attribute_variation"]:checked' );

			return isVariable() && $variation_attributes && $variation_attributes.length > 1;
		};

		/**
		 * Displays the given error and disables the sync checkbox.
		 * Accepted errors are 'missing_sku', 'missing_variation_sku', and 'multiple_attributes'.
		 *
		 * @since 2.2.3
		 *
		 * @param {string} error
		 */
		const showError = ( error ) => {
			$( '.wc-square-sync-with-square-error.' + error ).show();
			$( syncCheckboxID ).prop( 'disabled', true );
			$( syncCheckboxID ).prop( 'checked', false );
		};

		/**
		 * Hides the given error and maybe enables the sync checkbox.
		 * Accepted errors are 'missing_sku', 'missing_variation_sku', and 'multiple_attributes'.
		 *
		 * @since 2.2.3
		 *
		 * @param {string} error
		 * @param {boolean} enable Whether to enable the sync checkbox.
		 */
		const hideError = ( error, enable = true ) => {
			$( '.wc-square-sync-with-square-error.' + error ).hide();

			if ( enable ) {
				$( syncCheckboxID ).prop( 'disabled', false );
			}
		};

		/**
		 * Handle SKU.
		 *
		 * Disables the Sync with Square checkbox and toggles an inline notice when no SKU is set on a product.
		 *
		 * @since 2.0.
		 *
		 * @param {string} syncCheckboxID
		 */
		const handleSKU = ( syncCheckboxID ) => {
			if ( isVariable() ) {
				$( '#_sku' ).off( 'change keypress keyup' );
				hideError( 'missing_sku', ! hasMultipleAttributes() );

				const skus = $( 'input[id^="variable_sku"]' );
				skus.on( 'change keypress keyup', () => {
					if ( ! hasVariableSKUs( $.makeArray( skus ) ) || ! hasUniqueSKUs( $.makeArray( skus ) ) ) {
						showError( 'missing_variation_sku' );
					} else {
						hideError( 'missing_variation_sku', ! hasMultipleAttributes() );
					}
					$( syncCheckboxID ).triggerHandler( 'change' );
				} ).triggerHandler( 'change' );
			} else {
				$( 'input[id^="variable_sku"]' ).off( 'change keypress keyup' );
				hideError( 'missing_variation_sku', ! hasMultipleAttributes() );

				$( '#_sku' ).on( 'change keypress keyup', ( e ) => {
					if ( '' === $( e.target ).val().trim() ) {
						showError( 'missing_sku' );
					} else {
						hideError( 'missing_sku', ! hasMultipleAttributes() );
					}
					$( syncCheckboxID ).trigger( 'change' );
				} ).trigger( 'change' );
			}
		};

		/**
		 * Disables the Sync with Square checkbox and toggles an inline notice when more than one attribute is set on the product.
		 *
		 * @since 2.0.0
		 *
		 * @param {string} syncCheckboxID
		 */
		const handleAttributes = ( syncCheckboxID ) => {
			$( '#variable_product_options' ).on( 'reload', () => {
				if ( hasMultipleAttributes() ) {
					showError( 'multiple_attributes' );
				} else {
					hideError( 'multiple_attributes', isVariable() ? hasVariableSKUs : hasSKU() );
				}

				$( syncCheckboxID ).trigger( 'change' );
			} ).trigger( 'reload' );
		};

		/**
		 * Triggers an update to the sync checkbox, checking for relevant errors.
		 *
		 * @since 2.2.3
		 */
		const triggerUpdate = () => {
			handleSKU( syncCheckboxID );
			$( syncCheckboxID ).trigger( 'change' );

			// handleSKU misses cases where product is variable with no variations.
			if ( isVariable() && ! $( 'input[id^="variable_sku"]' ).length ) {
				showError( 'missing_variation_sku' );
			}
		};

		// fire once on page load
		handleAttributes( syncCheckboxID );

		/**
		 * Handle stock management.
		 *
		 * If product is managed by Square, handle stock fields according to chosen SoR.
		 */
		const $stockFields = $( '.stock_fields' );
		const $stockInput = $stockFields.find( '#_stock' );
		const $stockStatus = $( '.stock_status_field' );
		const $manageField = $( '._manage_stock_field' );
		const $manageInput = $manageField.find( '#_manage_stock' );
		const $manageDesc = $manageField.find( '.description' );
		// keep note of the original manage stock checkbox description, if we need to restore it later
		const manageDescOriginal = $manageDesc.text();
		// keep track of the original manage stock checkbox status, if we need to restore it later
		const manageStockOriginal = $( '#_manage_stock' ).is( ':checked' );

		$( syncCheckboxID ).on( 'change', ( e ) => {
			// only handle stock fields if inventory sync is enabled.
			if ( ! wc_square_admin_products.is_inventory_sync_enabled ) {
				return;
			}

			const variableProduct = wc_square_admin_products.variable_product_types.includes( $( '#product-type' ).val() );

			let useSquare;

			if ( $( e.target ).is( ':checked' ) && $( '#_square_item_variation_id' ).length > 0 ) {
				useSquare = true;

				$manageDesc.html( '<a href="' + wc_square_admin_products.settings_url + '">' + wc_square_admin_products.i18n.synced_with_square + '</a>' );
				$manageInput.prop( 'disabled', true ).prop( 'checked', ! variableProduct );
				$stockFields.hide();
				$stockStatus.hide();
				$stockInput.prop( 'readonly', true );

				if ( ! variableProduct ) {
					$stockFields.show();
				}

				// WooCommerce SoR - note: for variable products, the stock can be fetched for individual variations.
				if ( wc_square_admin_products.is_woocommerce_sor && ! variableProduct ) {
					// add inline note with a toggle to fetch stock from Square manually via AJAX (sanity check to avoid appending multiple times).
					if ( $( 'p._stock_field span.description' ).length === 0 ) {
						$stockInput.after(
							'<span class="description" style="display:block;clear:both;"><a href="#" id="fetch-stock-with-square">' + wc_square_admin_products.i18n.fetch_stock_with_square + '</a><div class="spinner" style="float:none;"></div></span>'
						);
					}
					$( '#fetch-stock-with-square' ).on( 'click', ( e ) => {
						e.preventDefault();
						const $spinner = $( 'p._stock_field span.description .spinner' );
						const data = {
							action: 'wc_square_fetch_product_stock_with_square',
							security: wc_square_admin_products.fetch_product_stock_with_square_nonce,
							product_id: $( '#post_ID' ).val(),
						};

						$spinner.css( 'visibility', 'visible' );

						$.post( wc_square_admin_products.ajax_url, data, ( response ) => {
							if ( response && response.success ) {
								const quantity = response.data;

								$stockInput.val( quantity );
								$stockFields.find( 'input[name=_original_stock]' ).val( quantity );
								$stockInput.prop( 'readonly', false );
								$( 'p._stock_field span.description' ).remove();
							} else {
								if ( response.data ) {
									$( '.inventory-fetch-error' ).remove();
									$spinner.after( '<span class="inventory-fetch-error" style="display:inline-block;color:red;">' + response.data + '</span>' );
								}

								$spinner.css( 'visibility', 'hidden' );
							}
						} );
					} );

				// Square SoR.
				} else if ( wc_square_admin_products.is_square_sor ) {
					// add inline note explaining stock is managed by Square (sanity check to avoid appending multiple times)
					if ( $( 'p._stock_field span.description' ).length === 0 ) {
						$stockInput.after( '<span class="description" style="display:block;clear:both;">' + wc_square_admin_products.i18n.managed_by_square + '</span>' );
					}
				}
			} else {
				useSquare = false;

				// remove any inline note to WooCommerce core stock fields that may have been added when Synced with Square is enabled.
				$( 'p._stock_field span.description' ).remove();
				$stockInput.prop( 'readonly', false );
				$manageDesc.html( manageDescOriginal );
				$manageInput.prop( 'disabled', false ).prop( 'checked', manageStockOriginal );

				if ( manageStockOriginal ) {
					$stockFields.show();
					$stockStatus.hide();
				} else {
					$stockStatus.show();
					$stockFields.hide();
				}
			}

			// handle variations data separately (HTML differs from parent UI!).
			$( '.woocommerce_variation' ).each( ( index, e ) => {
				// fetch relevant variables for each variation.
				const variationID = $( e ).find( 'h3 > a' ).attr( 'rel' );
				const $variationManageInput = $( e ).find( '.variable_manage_stock' );
				const $variationManageField = $variationManageInput.parent();
				const $variationStockInput = $( e ).find( '.wc_input_stock' );
				const $variationStockField = $variationStockInput.parent();

				// Square manages variations stock
				if ( useSquare ) {
					// disable stock management inputs
					$( '#wc_square_variation_manage_stock' ).prop( 'disabled', false );
					$variationStockInput.prop( 'readonly', true );
					$variationManageInput
						.prop( 'disabled', true )
						.prop( 'checked', true );

					// add a note that the variation stock is managed by square, but check if it wasn't added already to avoid duplicates.
					if ( 0 === $variationManageField.find( '.description' ).length ) {
						$variationManageInput.after( '<span class="description">(' + wc_square_admin_products.i18n.managed_by_square + ')</span>' );
					}

					if ( wc_square_admin_products.is_woocommerce_sor ) {
						const fetchVariationStockActionID = 'fetch-stock-with-square-' + variationID;

						// add inline note with a toggle to fetch stock from Square manually via AJAX (sanity check to avoid appending multiple times)
						if ( 0 === $variationStockField.find( 'span.description' ).length ) {
							$variationStockInput.after(
								'<span class="description" style="display:block;clear:both;"><a href="#" id="' + fetchVariationStockActionID + '">' + wc_square_admin_products.i18n.fetch_stock_with_square + '</a><div class="spinner" style="float:none;"></div></span>'
							);
						}

						// listen for requests to update stock with Square for the individual variation.
						$( '#' + fetchVariationStockActionID ).on( 'click', ( e ) => {
							e.preventDefault();
							const $spinner = $( e.target ).next( '.spinner' );
							const data = {
								action: 'wc_square_fetch_product_stock_with_square',
								security: wc_square_admin_products.fetch_product_stock_with_square_nonce,
								product_id: variationID,
							};

							$spinner.css( 'visibility', 'visible' );

							$.post( wc_square_admin_products.ajax_url, data, ( response ) => {
								if ( response && response.success ) {
									const quantity = response.data;

									$variationStockInput.val( quantity );
									$variationStockField.parent().find( 'input[name^="variable_original_stock"]' ).val( quantity );
									$variationStockInput.prop( 'readonly', false );
									$variationStockField.find( '.description' ).remove();
								} else {
									if ( response.data ) {
										$( '.inventory-fetch-error' ).remove();
										$spinner.after( '<span class="inventory-fetch-error" style="display:inline-block;color:red;">' + response.data + '</span>' );
									}

									$spinner.css( 'visibility', 'hidden' );
								}
							} );
						} );
					}
				} else {
					// restore WooCommerce stock when user chooses to disable Sync with Square checkbox.
					$variationStockInput.prop( 'readonly', false );
					$variationManageInput.prop( 'disabled', false );
					$variationManageInput.next( '.description' ).remove();
					$( e.target ).find( '#wc_square_variation_manage_stock' ).prop( 'disabled', true );
				}
			} );
		// initial page load handling.
		} ).trigger( 'change' );

		// trigger an update if the product type changes.
		$( '#product-type' ).on( 'change', () => {
			triggerUpdate();
		} );

		// trigger an update for variable products when variations are loaded, added, or removed.
		$( '#woocommerce-product-data' ).on( 'woocommerce_variations_loaded woocommerce_variations_added woocommerce_variations_removed', () => {
			triggerUpdate();
		} );
	}
} );
