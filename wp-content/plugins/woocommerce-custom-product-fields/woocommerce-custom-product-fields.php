<?php
/**
 * @package Woocommerce Custom Product Fields
 */
/*
Plugin Name: woocommerce-custom-product-fields
Plugin URI: http://blackbear.io
Description: Blackbear.io plugin for WooCommerce custom product fields
Version: 1.0.0
Author: Blackbear Development
Author URI: http://blackbear.io
License: GPLv2 or later
Text Domain: woocommerce-custom-product-fields
*/

/*
This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

Copyright 2005-2022 Automattic, Inc.
*/

defined( 'ABSPATH' ) || exit;

if ( version_compare( PHP_VERSION, '5.6.0', '<' ) ) {
	return;
}


/**
 * Display the custom text field
 * @since 1.0.0
 */
function cfwc_create_custom_field() {
 $args = array(
 'id' => 'custom_text_field_title',
 'label' => __( 'Custom Text Field Title', 'cfwc' ),
 'class' => 'cfwc-custom-field',
 'desc_tip' => true,
 'description' => __( 'Enter the title of your custom text field.', 'ctwc' ),
 );
 woocommerce_wp_text_input( $args );
}
add_action( 'woocommerce_product_options_general_product_data', 'cfwc_create_custom_field' );


/**
 * Save the custom field
 * @since 1.0.0
 */
function cfwc_save_custom_field( $post_id ) {
 $product = wc_get_product( $post_id );
 $title = isset( $_POST['custom_text_field_title'] ) ? $_POST['custom_text_field_title'] : '';
 $product->update_meta_data( 'custom_text_field_title', sanitize_text_field( $title ) );
 $product->save();
}
add_action( 'woocommerce_process_product_meta', 'cfwc_save_custom_field' );


/**
 * Display custom field on the front end
 * @since 1.0.0
 */
function cfwc_display_custom_field() {
 global $post;
 // Check for the custom field value
 $product = wc_get_product( $post->ID );
 $title = $product->get_meta( 'custom_text_field_title' );
 if( $title ) {
 // Only display our field if we've got a value for the field title
 printf(
 '<div class="cfwc-custom-field-wrapper"><label for="cfwc-title-field">%s</label><input type="text" id="cfwc-title-field" name="cfwc-title-field" value=""></div>',
 esc_html( $title )
 );
 }
}
add_action( 'woocommerce_before_add_to_cart_button', 'cfwc_display_custom_field' );


/**
 * Validate the text field
 * @since 1.0.0
 * @param Array $passed Validation status.
 * @param Integer $product_id Product ID.
 * @param Boolean $quantity Quantity
 */
function cfwc_validate_custom_field( $passed, $product_id, $quantity ) {
 if( empty( $_POST['cfwc-title-field'] ) ) {
 // Fails validation
 $passed = false;
 wc_add_notice( __( 'Please enter a Rider Name', 'cfwc' ), 'error' );
 }
 return $passed;
}
add_filter( 'woocommerce_add_to_cart_validation', 'cfwc_validate_custom_field', 10, 3 );


/**
 * Add the text field as item data to the cart object
 * @since 1.0.0
 * @param Array $cart_item_data Cart item meta data.
 * @param Integer $product_id Product ID.
 * @param Integer $variation_id Variation ID.
 * @param Boolean $quantity Quantity
 */
function cfwc_add_custom_field_item_data( $cart_item_data, $product_id, $variation_id, $quantity ) {
 if( ! empty( $_POST['cfwc-title-field'] ) ) {
 // Add the item data
 $cart_item_data['title_field'] = $_POST['cfwc-title-field'];
 }
 return $cart_item_data;
}
add_filter( 'woocommerce_add_cart_item_data', 'cfwc_add_custom_field_item_data', 10, 4 );


/**
 * Display the custom field value in the cart
 * @since 1.0.0
 */
function cfwc_cart_item_name( $name, $cart_item, $cart_item_key ) {
 if( isset( $cart_item['title_field'] ) ) {
 $name .= sprintf(
 '<p>%s</p>',
 esc_html( $cart_item['title_field'] )
 );
 }
 return $name;
}
add_filter( 'woocommerce_cart_item_name', 'cfwc_cart_item_name', 10, 3 );


/**
 * Add custom field to order object
 */
function cfwc_add_custom_data_to_order( $item, $cart_item_key, $values, $order ) {
 foreach( $item as $cart_item_key=>$values ) {
 if( isset( $values['title_field'] ) ) {
 $item->add_meta_data( __( 'Custom Field', 'cfwc' ), $values['title_field'], true );
 }
 }
}
add_action( 'woocommerce_checkout_create_order_line_item', 'cfwc_add_custom_data_to_order', 10, 4 );